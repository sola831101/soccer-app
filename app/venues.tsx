import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { useTeam } from '../lib/context/TeamContext';
import { createVenue, deleteVenue, updateVenue } from '../lib/firestore';
import { Venue } from '../lib/types';

export default function VenuesScreen() {
  const { venues, teamId } = useTeam();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [editName, setEditName] = useState('');
  const [editGoogleMapsUrl, setEditGoogleMapsUrl] = useState('');

  const handleOpenGoogleMaps = () => {
    Linking.openURL('https://maps.google.com');
  };

  const startEditing = (venue: Venue) => {
    setEditingVenue(venue);
    setEditName(venue.name);
    setEditGoogleMapsUrl(venue.googleMapsUrl || '');
  };

  const handleSaveEdit = async () => {
    if (!editingVenue || !teamId || !editName.trim()) return;
    try {
      await updateVenue(teamId, editingVenue.id, {
        name: editName.trim(),
        googleMapsUrl: editGoogleMapsUrl.trim() || undefined,
      });
      setEditingVenue(null);
    } catch {
      Alert.alert('エラー', '会場の更新に失敗しました');
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('入力エラー', '会場名を入力してください');
      return;
    }
    if (!teamId) return;

    setSaving(true);
    try {
      await createVenue(teamId, {
        name: name.trim(),
        address: address.trim() || undefined,
        googleMapsUrl: googleMapsUrl.trim() || undefined,
      });
      setName('');
      setAddress('');
      setGoogleMapsUrl('');
      setShowForm(false);
    } catch {
      Alert.alert('エラー', '会場の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (venue: Venue) => {
    if (!teamId) return;
    Alert.alert('確認', `「${venue.name}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => deleteVenue(teamId, venue.id),
      },
    ]);
  };

  const renderVenue = ({ item }: { item: Venue }) => {
    if (editingVenue?.id === item.id) {
      return (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>会場を編集</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="会場名 *"
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />
          <TextInput
            style={[styles.input, { marginTop: spacing.sm }]}
            value={editGoogleMapsUrl}
            onChangeText={setEditGoogleMapsUrl}
            placeholder="Google Maps URL（任意）"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity style={styles.openMapsBtn} onPress={handleOpenGoogleMaps}>
            <Ionicons name="map-outline" size={16} color={theme.primary} />
            <Text style={styles.openMapsBtnText}>Google Maps を開いてURLを取得</Text>
          </TouchableOpacity>
          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingVenue(null)}>
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.venueCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.venueName}>{item.name}</Text>
          {item.address && <Text style={styles.venueAddress}>{item.address}</Text>}
          {item.googleMapsUrl && (
            <TouchableOpacity
              style={styles.mapsLink}
              onPress={() => Linking.openURL(item.googleMapsUrl!)}
            >
              <Ionicons name="location" size={14} color={theme.primary} />
              <Text style={styles.mapsLinkText}>地図を開く</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => startEditing(item)} style={styles.editBtn}>
          <Ionicons name="pencil-outline" size={18} color={theme.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <FlatList
        data={venues}
        keyExtractor={(item) => item.id}
        renderItem={renderVenue}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color={theme.border} />
            <Text style={styles.emptyText}>保存済みの会場はありません</Text>
            <Text style={styles.emptySubText}>
              よく使う会場を登録しておくと{'\n'}試合登録時にすぐ選べます
            </Text>
          </View>
        }
        ListFooterComponent={
          showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>会場を追加</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="会場名 *"
                placeholderTextColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { marginTop: spacing.sm }]}
                value={address}
                onChangeText={setAddress}
                placeholder="住所（任意）"
                placeholderTextColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { marginTop: spacing.sm }]}
                value={googleMapsUrl}
                onChangeText={setGoogleMapsUrl}
                placeholder="Google Maps URL（任意）"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity style={styles.openMapsBtn} onPress={handleOpenGoogleMaps}>
                <Ionicons name="map-outline" size={16} color={theme.primary} />
                <Text style={styles.openMapsBtnText}>Google Maps を開いてURLを取得</Text>
              </TouchableOpacity>
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowForm(false);
                    setName('');
                    setAddress('');
                    setGoogleMapsUrl('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && { opacity: 0.6 }]}
                  onPress={handleAdd}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? '保存中...' : '保存'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowForm(true)}
            >
              <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
              <Text style={styles.addButtonText}>会場を追加</Text>
            </TouchableOpacity>
          )
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  list: {
    padding: spacing.md,
  },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  venueName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.text,
  },
  venueAddress: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    marginTop: 2,
  },
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 4,
  },
  mapsLinkText: {
    fontSize: fontSize.xs,
    color: theme.primary,
    fontWeight: '600',
  },
  editBtn: {
    padding: spacing.sm,
  },
  deleteBtn: {
    padding: spacing.sm,
  },
  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  openMapsBtnText: {
    fontSize: fontSize.sm,
    color: theme.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: spacing.md,
  },
  emptySubText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: theme.primary,
  },
  formCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  formTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.text,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm + 4,
    fontSize: fontSize.md,
    color: theme.text,
    backgroundColor: theme.white,
  },
  formButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.white,
  },
});
