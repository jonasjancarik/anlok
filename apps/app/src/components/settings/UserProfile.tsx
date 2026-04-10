import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types/entities';
import { Button, Divider, SectionCard, SubtleText } from '../common/ui';
import { ApiKeyManagement } from './ApiKeyManagement';
import { UserForm } from './UserForm';

interface UserProfileProps {
  token: string;
  user: User;
}

export const UserProfile = ({ token, user }: UserProfileProps) => {
  const { logout, updateUser } = useAuth();

  const handleSelfSave = async (updatedUser: User | null) => {
    if (updatedUser) {
      await updateUser(updatedUser);
    }
  };

  return (
    <SectionCard title="Profile">
      <SubtleText>Edit account profile and credentials.</SubtleText>
      <UserForm token={token} currentUser={user} targetUser={user} onSuccess={handleSelfSave} />

      {user.role === 'admin' ? (
        <>
          <Divider />
          <ApiKeyManagement token={token} userId={user.id} />
        </>
      ) : null}

      <Divider />
      <Button title="Logout" variant="danger" onPress={() => void logout()} />
    </SectionCard>
  );
};
