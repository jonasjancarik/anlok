import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { Apartment, User } from '../../types/entities';
import { Toast, ToastTone } from '../common/Toast';
import { roleLabel } from '../../lib/roles';
import { Avatar, Banner, Button, ListState, PageScroll, Screen, SectionCard, palette } from '../common/ui';
import { Feather } from '@expo/vector-icons';
import { PinManagement } from './PinManagement';
import { RfidManagement } from './RfidManagement';
import { ScheduleManagement } from './ScheduleManagement';
import { UserForm } from './UserForm';

interface UserManagementProps {
  token: string;
  currentUser: User;
  isActive: boolean;
  onCurrentUserUpdated: (nextUser: User) => void;
}

type ModalType = 'user' | 'pins' | 'rfid' | 'schedule' | null;
type ToastState = { message: string; type: ToastTone } | null;

const apartmentNumberForUser = (user: User) => user.apartment?.number ?? '';

// Lowercase and drop accents so "svobodova" finds "Svobodová".
const searchable = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const matchesQuery = (user: User, query: string) => {
  const haystack = searchable(
    [user.name, user.email ?? '', apartmentNumberForUser(user), roleLabel(user.role)].join(' ')
  );
  return searchable(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
};

const roleTone = (role: User['role']) => {
  if (role === 'admin') return { backgroundColor: '#F4E7D4', textColor: palette.warning };
  if (role === 'guest') return { backgroundColor: '#ECE5D9', textColor: palette.muted };
  return { backgroundColor: palette.primarySoft, textColor: palette.primary };
};

export const UserManagement = ({
  token,
  currentUser,
  isActive,
  onCurrentUserUpdated,
}: UserManagementProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadApartments = useCallback(async () => {
    try {
      const response = await api.get<Apartment[]>('/apartments', {
        headers: authHeaders(token),
      });
      setApartments(response.data);
    } catch {
      setApartments([]);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setListError('');

    try {
      const response = await api.get<User[]>('/users', {
        headers: authHeaders(token),
      });

      const currentApartmentNumber = currentUser.apartment?.number ?? '';
      const filtered =
        currentUser.role === 'admin' || !currentApartmentNumber
          ? response.data
          : response.data.filter(
              (item) => apartmentNumberForUser(item) === currentApartmentNumber
            );

      const sorted = [...filtered].sort((a, b) => {
        const apartmentA = apartmentNumberForUser(a);
        const apartmentB = apartmentNumberForUser(b);

        if (apartmentA === apartmentB) {
          return a.name.localeCompare(b.name);
        }

        return apartmentA.localeCompare(apartmentB, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });

      setUsers(sorted);
    } catch (nextError) {
      setListError(apiErrorMessage(nextError, 'Couldn’t load people. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }, [token, currentUser.role, currentUser.apartment?.number]);

  useEffect(() => {
    if (isActive) {
      void loadApartments();
      void loadUsers();
    }
  }, [isActive, loadApartments, loadUsers]);

  useEffect(() => () => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastTone = 'success') => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    setToast({ message, type });
    toastTimeout.current = setTimeout(() => {
      setToast(null);
      toastTimeout.current = null;
    }, 2600);
  }, []);

  const showSearch = currentUser.role === 'admin';
  const trimmedQuery = showSearch ? query.trim() : '';

  const visibleUsers = useMemo(
    () => (trimmedQuery ? users.filter((item) => matchesQuery(item, trimmedQuery)) : users),
    [users, trimmedQuery]
  );

  const apartmentCount = useMemo(
    () => apartments.length || new Set(users.map((item) => apartmentNumberForUser(item))).size,
    [apartments.length, users]
  );

  const groupedUsers = useMemo(() => {
    const usersByApartment = new Map<string, User[]>();

    visibleUsers.forEach((item) => {
      const apartmentNumber = apartmentNumberForUser(item) || 'Unknown';
      const group = usersByApartment.get(apartmentNumber) ?? [];
      group.push(item);
      usersByApartment.set(apartmentNumber, group);
    });

    return [...usersByApartment.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [visibleUsers]);

  const openModal = (type: ModalType, user: User | null) => {
    setSelectedUser(user);
    setModalType(type);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setModalType(null);
  };

  const handleUserSaved = async (result: User | null) => {
    if (result && result.id === currentUser.id) {
      onCurrentUserUpdated(result);
    }

    setError('');
    showToast(result ? 'Changes saved.' : 'Person removed.');
    closeModal();
    await loadUsers();
  };

  const toggleUserActive = async (target: User) => {
    if (updatingUserId !== null) {
      return;
    }

    setError('');
    setUpdatingUserId(target.id);

    try {
      const response = await api.put<User>(
        `/users/${target.id}`,
        { is_active: !target.is_active },
        { headers: authHeaders(token) }
      );

      setUsers((prev) =>
        prev.map((item) => (item.id === target.id ? { ...item, is_active: response.data.is_active } : item))
      );

      if (target.id === currentUser.id) {
        onCurrentUserUpdated({ ...target, is_active: response.data.is_active });
      }

      showToast(
        response.data.is_active
          ? `${target.name} can use the door again.`
          : `${target.name} is disabled and can’t open the door.`
      );
    } catch (nextError) {
      showToast(apiErrorMessage(nextError, 'Couldn’t change this person’s access.'), 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const modalHeading = modalType === 'pins'
    ? 'Door PINs'
    : modalType === 'rfid'
      ? 'Cards and key fobs'
      : modalType === 'schedule'
        ? 'Guest schedule'
        : selectedUser
          ? selectedUser.name
          : 'Add a person';

  const canToggle = (item: User) =>
    item.id !== currentUser.id && !(currentUser.role === 'apartment_admin' && item.role === 'admin');

  return (
    <View style={userStyles.container}>
      <View style={userStyles.toolbar}>
        <Text style={userStyles.scopeText}>
          {currentUser.role === 'admin'
            ? trimmedQuery
              ? `${visibleUsers.length} of ${users.length} ${users.length === 1 ? 'person' : 'people'}`
              : `${users.length} ${users.length === 1 ? 'person' : 'people'} in ${apartmentCount} ${apartmentCount === 1 ? 'apartment' : 'apartments'}`
            : `Apartment ${currentUser.apartment?.number ?? ''}`}
        </Text>
        <Button
          title="Add person"
          size="small"
          icon={<Feather name="user-plus" size={15} color="#fff" />}
          onPress={() => openModal('user', null)}
        />
      </View>

      {showSearch && users.length > 0 ? (
        <View style={userStyles.search}>
          <Feather name="search" size={18} color={palette.muted} />
          <TextInput
            accessibilityLabel="Search people"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
            onChangeText={setQuery}
            placeholder="Search by name, email, or apartment"
            placeholderTextColor={palette.subtle}
            returnKeyType="search"
            style={userStyles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setQuery('')}
              style={userStyles.searchClear}
            >
              <Feather name="x" size={16} color={palette.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? <Banner type="error" text={error} /> : null}
      {listError && users.length > 0 ? <Banner type="error" text={listError} /> : null}

      {groupedUsers.length === 0 && trimmedQuery && users.length > 0 ? (
        <View style={userStyles.noMatches}>
          <Text style={userStyles.noMatchesTitle}>No one matches “{trimmedQuery}”</Text>
          <Text style={userStyles.noMatchesText}>Check the spelling, or search by apartment number or email.</Text>
          <Button title="Clear search" size="small" variant="secondary" onPress={() => setQuery('')} />
        </View>
      ) : groupedUsers.length === 0 ? (
        <ListState
          loading={loading}
          error={listError}
          emptyTitle="No people yet"
          emptyText="Add a resident or guest to give them access to the door."
          onRetry={() => void loadUsers()}
        />
      ) : (
        <View style={userStyles.groupList}>
          {groupedUsers.map(([apartmentNumber, apartmentUsers]) => (
            <View key={apartmentNumber} style={userStyles.group}>
              <Text accessibilityRole="header" style={userStyles.groupTitle}>
                Apartment {apartmentNumber}
              </Text>

              <SectionCard>
                {apartmentUsers.map((item, index) => {
                  const tone = roleTone(item.role);
                  const isMe = item.id === currentUser.id;
                  return (
                    <View
                      key={item.id}
                      style={[
                        userStyles.userRow,
                        index === apartmentUsers.length - 1 ? userStyles.userRowLast : null,
                      ]}
                    >
                      <Pressable
                        accessibilityHint="Opens this person's details"
                        accessibilityLabel={`${item.name}, ${roleLabel(item.role)}${item.is_active ? '' : ', disabled'}`}
                        accessibilityRole="button"
                        onPress={() => openModal('user', item)}
                        style={({ pressed }) => [userStyles.userHeader, pressed ? { opacity: 0.7 } : null]}
                      >
                        <Avatar name={item.name} muted={!item.is_active} />
                        <View style={userStyles.identity}>
                          <View style={userStyles.nameRow}>
                            <Text style={[userStyles.name, item.is_active ? null : userStyles.inactiveText]} numberOfLines={1}>
                              {item.name}{isMe ? ' (you)' : ''}
                            </Text>
                          </View>
                          <Text style={userStyles.email} numberOfLines={1}>{item.email || 'No email · can’t sign in to the app'}</Text>
                          <View style={userStyles.badges}>
                            <View style={[userStyles.roleBadge, { backgroundColor: tone.backgroundColor }]}>
                              <Text style={[userStyles.roleText, { color: tone.textColor }]} numberOfLines={1}>
                                {roleLabel(item.role)}
                              </Text>
                            </View>
                            {!item.is_active ? (
                              <View style={[userStyles.roleBadge, userStyles.disabledBadge]}>
                                <Text style={[userStyles.roleText, { color: palette.danger }]}>Disabled</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <Feather name="chevron-right" size={20} color={palette.subtle} />
                      </Pressable>

                      <View style={userStyles.actions}>
                        <Button size="small" title="PINs" variant="secondary" icon={<Feather name="hash" size={14} color={palette.text} />} onPress={() => openModal('pins', item)} style={userStyles.actionButton} />
                        <Button size="small" title="Cards" variant="secondary" icon={<Feather name="credit-card" size={14} color={palette.text} />} onPress={() => openModal('rfid', item)} style={userStyles.actionButton} />
                        {item.role === 'guest' ? (
                          <Button
                            size="small"
                            title="Schedule"
                            variant="secondary"
                            icon={<Feather name="clock" size={14} color={palette.text} />}
                            onPress={() => openModal('schedule', item)}
                            style={userStyles.actionButton}
                          />
                        ) : null}
                        {canToggle(item) ? (
                          <Button
                            size="small"
                            title={item.is_active ? 'Disable' : 'Enable'}
                            variant="ghost"
                            loading={updatingUserId === item.id}
                            disabled={updatingUserId !== null}
                            accessibilityLabel={item.is_active ? `Disable ${item.name}` : `Enable ${item.name}`}
                            accessibilityHint={item.is_active ? 'Stops their PINs and cards from opening the door' : 'Lets their PINs and cards open the door again'}
                            icon={<Feather name={item.is_active ? 'slash' : 'check'} size={14} color={item.is_active ? palette.danger : palette.success} />}
                            textStyle={{ color: item.is_active ? palette.danger : palette.success }}
                            onPress={() => void toggleUserActive(item)}
                            style={userStyles.actionButton}
                          />
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </SectionCard>
            </View>
          ))}
        </View>
      )}

      <Modal visible={modalType !== null} animationType="slide" onRequestClose={closeModal}>
        <Screen>
          <PageScroll>
            <View style={userStyles.modalHeader}>
              <View style={userStyles.modalHeadingCopy}>
                <Text style={userStyles.modalEyebrow}>
                  {modalType === 'user' ? (selectedUser ? roleLabel(selectedUser.role) : 'People') : selectedUser?.name || 'People'}
                </Text>
                <Text style={userStyles.modalTitle}>{modalHeading}</Text>
              </View>
              <Button
                title=""
                accessibilityLabel={`Close ${modalHeading}`}
                icon={<Feather name="x" size={24} color={palette.muted} />}
                variant="ghost"
                size="icon"
                onPress={closeModal}
              />
            </View>

            {modalType === 'user' ? (
              <UserForm
                token={token}
                currentUser={currentUser}
                targetUser={selectedUser}
                onSuccess={handleUserSaved}
                onCancel={closeModal}
              />
            ) : null}

            {modalType === 'pins' && selectedUser ? (
              <PinManagement token={token} user={selectedUser} />
            ) : null}

            {modalType === 'rfid' && selectedUser ? (
              <RfidManagement
                token={token}
                user={selectedUser}
                canUseScanner={currentUser.role === 'admin'}
              />
            ) : null}

            {modalType === 'schedule' && selectedUser ? (
              <ScheduleManagement token={token} user={selectedUser} />
            ) : null}
          </PageScroll>
        </Screen>
      </Modal>

      <Toast
        message={toast?.message ?? ''}
        tone={toast?.type}
        visible={toast !== null}
        onDismiss={() => setToast(null)}
      />
    </View>
  );
};

const userStyles = StyleSheet.create({
  container: {
    gap: 16,
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  scopeText: {
    color: palette.muted,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  search: {
    alignItems: 'center',
    backgroundColor: palette.field,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: palette.text,
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  searchClear: {
    alignItems: 'center',
    backgroundColor: '#ECE5D9',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  noMatches: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  noMatchesTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  noMatchesText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 300,
    textAlign: 'center',
  },
  groupList: {
    gap: 20,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  userRow: {
    borderBottomColor: '#ECE4D8',
    borderBottomWidth: 1,
    gap: 12,
    paddingBottom: 16,
  },
  userRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  userHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  identity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  name: {
    color: palette.text,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  inactiveText: {
    color: palette.muted,
  },
  email: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  disabledBadge: {
    backgroundColor: '#F8E8E4',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  modalEyebrow: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
});
