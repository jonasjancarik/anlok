import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { UnlockButtonStyle, usePreferences } from '../../contexts/PreferencesContext';
import { useServerConfig } from '../../contexts/ServerConfigContext';
import {
  registerForAccessNotifications,
  sendAccessNotificationTest,
} from '../../lib/notifications';
import { User } from '../../types/entities';
import { Button, SectionCard, SegmentedControl, palette, styles as uiStyles } from '../common/ui';
import { ApiKeyManagement } from './ApiKeyManagement';
import { UserForm } from './UserForm';

interface UserProfileProps {
  token: string;
  user: User;
}

const notificationsSupported = Platform.OS !== 'web';

export const UserProfile = ({ token, user }: UserProfileProps) => {
  const navigation = useNavigation<any>();
  const { logout, updateUser } = useAuth();
  const { apiUrl } = useServerConfig();
  const { unlockButtonStyle, setUnlockButtonStyle } = usePreferences();
  const [notificationStatus, setNotificationStatus] = useState(
    notificationsSupported
      ? 'Get a notification on this phone when someone opens the door.'
      : 'Door notifications are available in the mobile app.'
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
      <UserForm token={token} currentUser={user} targetUser={user} onSuccess={handleSelfSave} variant="self" />

      <SectionCard title="Unlock button" description="Choose how the unlock button looks on this device.">
        <SegmentedControl<UnlockButtonStyle>
          options={[
            { key: 'green', label: 'Green' },
            { key: 'minimal', label: 'Minimal' },
          ]}
          value={unlockButtonStyle}
          onChange={(next) => void setUnlockButtonStyle(next)}
        />
      </SectionCard>

      <SectionCard title="Notifications" description={notificationStatus}>
        {notificationsSupported ? (
          <View style={profileStyles.buttonRow}>
            <Button
              title="Turn on"
              loading={registeringNotifications}
              disabled={testingNotifications}
              icon={<Feather name="bell" size={16} color="#fff" />}
              onPress={() => void enableNotifications()}
              style={profileStyles.flexButton}
            />
            <Button
              title="Send a test"
              variant="secondary"
              loading={testingNotifications}
              disabled={registeringNotifications}
              icon={<Feather name="send" size={16} color={palette.text} />}
              onPress={() => void sendTestNotification()}
              style={profileStyles.flexButton}
            />
          </View>
        ) : null}
      </SectionCard>

      {user.role === 'admin' ? (
        <ApiKeyManagement token={token} userId={user.id} />
      ) : null}

      <SectionCard title="Door server">
        <View style={profileStyles.serverRow}>
          <View style={profileStyles.serverIcon}>
            <Feather name="server" size={16} color={palette.primary} />
          </View>
          <Text selectable numberOfLines={1} style={profileStyles.serverUrl}>{apiUrl}</Text>
        </View>
        <Text style={uiStyles.subtleText}>
          This device opens the door and loads your account through this server.
        </Text>
        {Platform.OS !== 'web' ? (
          <Button
            title="Change server"
            variant="secondary"
            icon={<Feather name="edit-2" size={16} color={palette.text} />}
            onPress={() => navigation.getParent()?.navigate('ServerSetup')}
          />
        ) : null}
      </SectionCard>

      <Button
        title="Sign out"
        variant="secondary"
        icon={<Feather name="log-out" size={16} color={palette.danger} />}
        onPress={() => void logout()}
        style={profileStyles.signOut}
        textStyle={{ color: palette.danger }}
      />
    </View>
  );
};

const profileStyles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flexButton: {
    flexBasis: 140,
    flexGrow: 1,
  },
  serverRow: {
    alignItems: 'center',
    backgroundColor: palette.field,
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  serverIcon: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  serverUrl: {
    color: palette.text,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  signOut: {
    backgroundColor: 'transparent',
    marginTop: 4,
  },
});
