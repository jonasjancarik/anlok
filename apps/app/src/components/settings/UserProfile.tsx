import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { registerForAccessNotifications } from '../../lib/notifications';
import { User } from '../../types/entities';
import { Button, SectionCard, styles as uiStyles } from '../common/ui';
import { ApiKeyManagement } from './ApiKeyManagement';
import { UserForm } from './UserForm';

interface UserProfileProps {
  token: string;
  user: User;
}

export const UserProfile = ({ token, user }: UserProfileProps) => {
  const { logout, updateUser } = useAuth();
  const [notificationStatus, setNotificationStatus] = useState('Notifications are not enabled on this device.');
  const [registeringNotifications, setRegisteringNotifications] = useState(false);

  const handleSelfSave = async (updatedUser: User | null) => {
    if (updatedUser) {
      await updateUser(updatedUser);
    }
  };

  const enableNotifications = async () => {
    setRegisteringNotifications(true);
    const result = await registerForAccessNotifications(token);
    setNotificationStatus(result.message);
    setRegisteringNotifications(false);
  };

  return (
    <View style={{ gap: 16 }}>
      <UserForm token={token} currentUser={user} targetUser={user} onSuccess={handleSelfSave} />

      {user.role === 'admin' ? (
        <ApiKeyManagement token={token} userId={user.id} />
      ) : null}

      <SectionCard title="Notifications">
        <Text style={uiStyles.subtleText}>{notificationStatus}</Text>
        <Button
          title="Enable on this device"
          variant="secondary"
          loading={registeringNotifications}
          icon={<Feather name="bell" size={16} color="#17201A" />}
          onPress={() => void enableNotifications()}
        />
      </SectionCard>

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
