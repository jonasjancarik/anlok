import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { Apartment, User } from '../../types/entities';
import { Toast, ToastTone } from '../common/Toast';
import { Banner, Button, Divider, PageScroll, Screen, SectionCard, SubtleText, palette } from '../common/ui';
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

export const UserManagement = ({
  token,
  currentUser,
  isActive,
  onCurrentUserUpdated,
}: UserManagementProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    setError('');

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
      setError(apiErrorMessage(nextError, 'Failed to fetch users.'));
    } finally {
      setLoading(false);
    }
  }, [token, currentUser.role, currentUser.apartment?.number]);

  useEffect(() => {
    loadApartments();
    loadUsers();
  }, [loadApartments, loadUsers]);

  useEffect(() => {
    if (isActive) {
      loadApartments();
      loadUsers();
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

  const groupedUsers = useMemo(() => {
    const usersByApartment = new Map<string, User[]>();

    users.forEach((item) => {
      const apartmentNumber = apartmentNumberForUser(item) || 'Unknown';
      const group = usersByApartment.get(apartmentNumber) ?? [];
      group.push(item);
      usersByApartment.set(apartmentNumber, group);
    });

    return [...usersByApartment.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [users]);

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
    showToast(result ? 'User saved.' : 'User deleted.');
    closeModal();
    await loadUsers();
  };

  const toggleUserActive = async (target: User) => {
    setError('');

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

      showToast(`User ${response.data.is_active ? 'activated' : 'deactivated'}.`);
    } catch (nextError) {
      showToast(apiErrorMessage(nextError, 'Failed to update user status.'), 'error');
    }
  };

  const roleColor = (role: User['role']) => {
    if (role === 'admin') {
      return {
        backgroundColor: '#F8E8E4',
        borderColor: '#E5B7AF',
        textColor: palette.danger,
      };
    }

    if (role === 'apartment_admin') {
      return {
        backgroundColor: palette.primarySoft,
        borderColor: '#C7D8CE',
        textColor: palette.primary,
      };
    }

    return {
      backgroundColor: '#E3F1EA',
      borderColor: '#BDD8CA',
      textColor: palette.success,
    };
  };

  const roleLabel = (role: User['role']) => {
    if (role === 'apartment_admin') {
      return 'Apt admin';
    }

    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <SectionCard>
      <View style={userStyles.toolbar}>
        <Button
          title="Add user"
          size="small"
          icon={<Feather name="plus" size={14} color="#fff" />}
          onPress={() => openModal('user', null)}
        />
        <View style={userStyles.scopePill}>
          <Text style={userStyles.scopeText}>
            {currentUser.role === 'admin' ? 'All apartments' : `Apartment ${currentUser.apartment?.number ?? 'current'}`}
          </Text>
        </View>
      </View>

      {error ? <Banner type="error" text={error} /> : null}

      <Divider />
      {groupedUsers.length === 0 ? (
        <SubtleText>{loading ? 'Loading users...' : 'No users found.'}</SubtleText>
      ) : (
        <View style={userStyles.groupList}>
          {groupedUsers.map(([apartmentNumber, apartmentUsers]) => (
            <View key={apartmentNumber} style={userStyles.group}>
              <View style={userStyles.groupHeader}>
                <Text style={userStyles.groupTitle}>Apartment {apartmentNumber}</Text>
                <Text style={userStyles.groupCount}>
                  {apartmentUsers.length} {apartmentUsers.length === 1 ? 'user' : 'users'}
                </Text>
              </View>

              {apartmentUsers.map((item, index) => {
                const roleStyle = roleColor(item.role);
                return (
                  <View
                    key={item.id}
                    style={[
                      userStyles.userRow,
                      index === apartmentUsers.length - 1 ? userStyles.userRowLast : null,
                      item.is_active ? null : userStyles.userRowInactive,
                    ]}
                  >
                    <View style={userStyles.userHeader}>
                      <View style={userStyles.identity}>
                        <Text style={userStyles.name} numberOfLines={1}>{item.name}</Text>
                        <Text style={userStyles.email} numberOfLines={1}>{item.email || 'No email'}</Text>
                      </View>
                      <View style={userStyles.metaActions}>
                        <View style={[userStyles.roleBadge, { backgroundColor: roleStyle.backgroundColor, borderColor: roleStyle.borderColor }]}>
                          <Text style={[userStyles.roleText, { color: roleStyle.textColor }]} numberOfLines={1}>
                            {roleLabel(item.role)}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityLabel={item.is_active ? `Disable ${item.name}` : `Enable ${item.name}`}
                          accessibilityRole="button"
                          disabled={currentUser.role === 'apartment_admin' && item.role === 'admin'}
                          onPress={() => toggleUserActive(item)}
                          style={({ pressed }) => [
                            userStyles.statusToggle,
                            item.is_active ? userStyles.statusToggleDanger : userStyles.statusToggleSuccess,
                            pressed ? { opacity: 0.72 } : null,
                          ]}
                        >
                          <Feather name={item.is_active ? 'slash' : 'check'} size={14} color={item.is_active ? palette.danger : palette.success} />
                        </Pressable>
                      </View>
                    </View>

                    <View style={userStyles.actions}>
                      <Button size="small" title="Edit" variant="secondary" icon={<Feather name="edit-2" size={12} color={palette.text} />} onPress={() => openModal('user', item)} style={userStyles.actionButton} />
                      <Button size="small" title="PINs" variant="secondary" icon={<Feather name="grid" size={12} color={palette.text} />} onPress={() => openModal('pins', item)} style={userStyles.actionButton} />
                      <Button size="small" title="RFIDs" variant="secondary" icon={<Feather name="radio" size={12} color={palette.text} />} onPress={() => openModal('rfid', item)} style={userStyles.actionButton} />
                      {item.role === 'guest' ? (
                        <Button
                          size="small"
                          title="Schedule"
                          variant="secondary"
                          icon={<Feather name="clock" size={12} color={palette.text} />}
                          onPress={() => openModal('schedule', item)}
                          style={userStyles.actionButton}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      <Modal visible={modalType !== null} animationType="slide" onRequestClose={closeModal}>
        <Screen>
          <PageScroll>
            <Button
              title=""
              icon={<Feather name="x" size={24} color={palette.muted} />}
              variant="ghost"
              size="icon"
              onPress={closeModal}
              style={{ alignSelf: 'flex-start', marginBottom: 8, marginLeft: -8 }}
            />

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
              <RfidManagement token={token} user={selectedUser} />
            ) : null}

            {modalType === 'schedule' && selectedUser ? (
              <ScheduleManagement token={token} user={selectedUser} />
            ) : null}
          </PageScroll>
        </Screen>
      </Modal>

      {apartments.length === 0 ? null : <SubtleText style={{ marginTop: 12, textAlign: 'center', fontSize: 12 }}>Total apartments configured: {apartments.length}</SubtleText>}

      <Toast
        message={toast?.message ?? ''}
        tone={toast?.type}
        visible={toast !== null}
        onDismiss={() => setToast(null)}
      />
    </SectionCard>
  );
};

const userStyles = StyleSheet.create({
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  scopePill: {
    backgroundColor: palette.field,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scopeText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  groupList: {
    gap: 18,
  },
  group: {
    gap: 0,
  },
  groupHeader: {
    alignItems: 'center',
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  groupTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '900',
  },
  groupCount: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  userRow: {
    borderBottomColor: '#ECE4D8',
    borderBottomWidth: 1,
    gap: 10,
    paddingVertical: 14,
  },
  userRowLast: {
    borderBottomWidth: 0,
  },
  userRowInactive: {
    opacity: 0.52,
  },
  userHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  email: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  roleBadge: {
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
    maxWidth: 112,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '900',
  },
  metaActions: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 6,
    maxWidth: 124,
  },
  statusToggle: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 32,
  },
  statusToggleDanger: {
    backgroundColor: '#FCF2EE',
    borderColor: '#E9C6BD',
  },
  statusToggleSuccess: {
    backgroundColor: '#E9F4EE',
    borderColor: '#BDD8CA',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
