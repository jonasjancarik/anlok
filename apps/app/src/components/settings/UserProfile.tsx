import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types/entities';
import { Button, SectionCard } from '../common/ui';
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
    <View style={{ gap: 16 }}>
      <UserForm token={token} currentUser={user} targetUser={user} onSuccess={handleSelfSave} />

      {user.role === 'admin' ? (
        <ApiKeyManagement token={token} userId={user.id} />
      ) : null}

      <SectionCard>
        <Button 
          title="Sign Out" 
          variant="danger" 
          icon={<Feather name="log-out" size={16} color="#fff" />}
          onPress={() => void logout()} 
        />
      </SectionCard>
    </View>
  );
};
