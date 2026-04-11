import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ApartmentManagement } from '../components/settings/ApartmentManagement';
import { UserManagement } from '../components/settings/UserManagement';
import { UserProfile } from '../components/settings/UserProfile';
import { Button, PageScroll, Screen, SectionCard, palette, styles as uiStyles } from '../components/common/ui';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types/entities';

type TabKey = 'profile' | 'users' | 'apartments';

export const SettingsScreen = () => {
  const { user, token, updateUser } = useAuth();
  const [tab, setTab] = useState<TabKey>('profile');

  const tabs = useMemo(() => {
    const base: Array<{ key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }> = [
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'users', label: 'Users', icon: 'users' },
    ];

    if (user?.role === 'admin') {
      base.push({ key: 'apartments', label: 'Apartments', icon: 'home' });
    }

    return base;
  }, [user?.role]);

  if (!user || !token) {
    return null;
  }

  const renderTab = () => {
    if (tab === 'profile') {
      return <UserProfile token={token} user={user} />;
    }

    if (tab === 'users') {
      return (
        <UserManagement
          token={token}
          currentUser={user}
          isActive
          onCurrentUserUpdated={(nextUser: User) => {
            void updateUser(nextUser);
          }}
        />
      );
    }

    return <ApartmentManagement token={token} />;
  };

  return (
    <Screen>
      <PageScroll>
        <SectionCard title="Settings">
          <Text style={[uiStyles.subtleText, { marginBottom: 8 }]}>Manage your profile, users, and apartment configurations.</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {tabs.map((option) => {
              const isSelected = tab === option.key;
              return (
                <Button
                  key={option.key}
                  title={option.label}
                  variant={isSelected ? 'primary' : 'secondary'}
                  onPress={() => setTab(option.key)}
                  icon={<Feather name={option.icon} size={18} color={isSelected ? '#fff' : palette.text} />}
                  style={{ minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, flexGrow: 1 }}
                />
              );
            })}
          </View>
        </SectionCard>
        {renderTab()}
      </PageScroll>
    </Screen>
  );
};
