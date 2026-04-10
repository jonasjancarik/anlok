import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { Apartment, User } from '../../types/entities';
import { Banner, Button, Chip, Divider, SectionCard, SubtleText } from '../common/ui';
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
  const [success, setSuccess] = useState('');

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

      const filtered =
        currentUser.role === 'admin'
          ? response.data
          : response.data.filter((item) => item.apartment_id === currentUser.apartment_id);

      const sorted = [...filtered].sort((a, b) => {
        if (a.apartment_id === b.apartment_id) {
          return a.name.localeCompare(b.name);
        }

        return a.apartment_id.localeCompare(b.apartment_id, undefined, {
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
  }, [token, currentUser.role, currentUser.apartment_id]);

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

  const groupedUsers = useMemo(() => {
    const usersByApartment = new Map<string, User[]>();

    users.forEach((item) => {
      const apartmentNumber = item.apartment?.number ?? item.apartment_id;
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

    setSuccess(result ? 'User saved.' : 'User deleted.');
    closeModal();
    await loadUsers();
  };

  const toggleUserActive = async (target: User) => {
    setError('');
    setSuccess('');

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

      setSuccess(`User ${response.data.is_active ? 'activated' : 'deactivated'}.`);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to update user status.'));
    }
  };

  const roleColor = (role: User['role']) => {
    if (role === 'admin') {
      return 'danger';
    }

    if (role === 'apartment_admin') {
      return 'default';
    }

    return 'success';
  };

  return (
    <SectionCard title="Users">
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title="Add User" onPress={() => openModal('user', null)} />
        <SubtleText>
          Visible apartments: {currentUser.role === 'admin' ? 'all' : currentUser.apartment_id}
        </SubtleText>
      </View>

      {success ? <Banner type="success" text={success} /> : null}
      {error ? <Banner type="error" text={error} /> : null}

      <Divider />
      {groupedUsers.length === 0 ? (
        <SubtleText>{loading ? 'Loading users...' : 'No users found.'}</SubtleText>
      ) : (
        <View style={{ gap: 12 }}>
          {groupedUsers.map(([apartmentNumber, apartmentUsers]) => (
            <View key={apartmentNumber} style={{ gap: 8 }}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>Apartment {apartmentNumber}</Text>
              {apartmentUsers.map((item) => (
                <View
                  key={item.id}
                  style={{
                    borderWidth: 1,
                    borderColor: '#d2dbf0',
                    borderRadius: 10,
                    padding: 10,
                    gap: 6,
                    opacity: item.is_active ? 1 : 0.55,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
                    <Chip text={item.role} tone={roleColor(item.role)} />
                  </View>
                  <SubtleText>{item.email || 'No email'}</SubtleText>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <Button title="Edit" variant="secondary" onPress={() => openModal('user', item)} />
                    <Button title="PINs" variant="secondary" onPress={() => openModal('pins', item)} />
                    <Button title="RFIDs" variant="secondary" onPress={() => openModal('rfid', item)} />
                    {item.role === 'guest' ? (
                      <Button
                        title="Schedule"
                        variant="secondary"
                        onPress={() => openModal('schedule', item)}
                      />
                    ) : null}
                    <Button
                      title={item.is_active ? 'Deactivate' : 'Activate'}
                      variant={item.is_active ? 'danger' : 'primary'}
                      disabled={currentUser.role === 'apartment_admin' && item.role === 'admin'}
                      onPress={() => toggleUserActive(item)}
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      <Modal visible={modalType !== null} animationType="slide" onRequestClose={closeModal}>
        <View style={{ flex: 1, backgroundColor: '#f4f7ff' }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
            <Pressable
              onPress={closeModal}
              style={{
                alignSelf: 'flex-start',
                borderWidth: 1,
                borderColor: '#d2dbf0',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ fontWeight: '700' }}>Close</Text>
            </Pressable>

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
          </ScrollView>
        </View>
      </Modal>

      {apartments.length === 0 ? null : <SubtleText>Total apartments: {apartments.length}</SubtleText>}
    </SectionCard>
  );
};
