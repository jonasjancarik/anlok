import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useServerConfig } from '../../contexts/ServerConfigContext';
import {
  registerForAccessNotifications,
  sendAccessNotificationTest,
} from '../../lib/notifications';
import { User } from '../../types/entities';
import { Button, SectionCard, palette, styles as uiStyles } from '../common/ui';
import { ApiKeyManagement } from './ApiKeyManagement';
import { UserForm } from './UserForm';

interface UserProfileProps {
  token: string;
  user: User;
}

export const UserProfile = ({ token, user }: UserProfileProps) => {
  const navigation = useNavigation<any>();
  const { logout, updateUser } = useAuth();
  const { apiUrl } = useServerConfig();
  const [notificationStatus, setNotificationStatus] = useState(
    'Manage door activity notifications for this device.'
  );
  const [registeringNotifications, setRegisteringNotifications] = useState(false);
  const [testingNotifications, setTestingNotifications] = useState(false);

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

  const sendTestNotification = async () => {
    setTestingNotifications(true);
    const result = await sendAccessNotificationTest(token);
    setNotificationStatus(result.message);
    setTestingNotifications(false);
  };

  return (
    <View style={{ gap: 16 }}>
      <UserForm token={token} currentUser={user} targetUser={user} onSuccess={handleSelfSave} />

      {user.role === 'admin' ? (
        <ApiKeyManagement token={token} userId={user.id} />
      ) : null}

      <SectionCard title="Server">
        <Text style={profileStyles.label}>Current server</Text>
        <Text selectable style={profileStyles.serverUrl}>{apiUrl}</Text>
        <Text style={uiStyles.subtleText}>
          Anlok sends door controls and account requests to this address.
        </Text>
        {Platform.OS !== 'web' ? (
          <Button
            title="Change server"
            variant="secondary"
            icon={<Feather name="server" size={16} color={palette.text} />}
            onPress={() => navigation.getParent()?.navigate('ServerSetup')}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Notifications">
        <Text style={uiStyles.subtleText}>{notificationStatus}</Text>
        <Button
          title="Enable on this device"
          variant="secondary"
          loading={registeringNotifications}
          disabled={testingNotifications}
          icon={<Feather name="bell" size={16} color="#17201A" />}
          onPress={() => void enableNotifications()}
        />
        <Button
          title="Send test notification"
          variant="secondary"
          loading={testingNotifications}
          disabled={registeringNotifications}
          icon={<Feather name="send" size={16} color="#17201A" />}
          onPress={() => void sendTestNotification()}
        />
      </SectionCard>

      <SectionCard>
        <Button 
          title="Sign out"
          variant="danger" 
          icon={<Feather name="log-out" size={16} color="#fff" />}
          onPress={() => void logout()} 
        />
      </SectionCard>
    </View>
  );
};

const profileStyles = StyleSheet.create({
  label: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  serverUrl: {
    color: palette.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 20,
  },
});
