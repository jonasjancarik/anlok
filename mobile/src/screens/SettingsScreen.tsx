import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { ApartmentManagement } from '../components/settings/ApartmentManagement';
import { UserManagement } from '../components/settings/UserManagement';
import { UserProfile } from '../components/settings/UserProfile';
import { Button, PageScroll, Screen, SectionCard } from '../components/common/ui';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types/entities';

type TabKey = 'profile' | 'users' | 'apartments';

export const SettingsScreen = () => {
  const { user, token, updateUser } = useAuth();
  const [tab, setTab] = useState<TabKey>('profile');

  const tabs = useMemo(() => {
    const base: Array<{ key: TabKey; label: string }> = [
      { key: 'profile', label: 'Profile' },
      { key: 'users', label: 'Users' },
    ];

    if (user?.role === 'admin') {
      base.push({ key: 'apartments', label: 'Apartments' });
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
          <Text style={{ color: '#475569' }}>Manage profile, users, apartment config.</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {tabs.map((option) => (
              <Button
                key={option.key}
                title={option.label}
                variant={tab === option.key ? 'primary' : 'secondary'}
                onPress={() => setTab(option.key)}
              />
            ))}
          </View>
        </SectionCard>
        {renderTab()}
      </PageScroll>
    </Screen>
  );
};
