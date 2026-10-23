import React, { useEffect, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ApartmentManagement } from '../components/settings/ApartmentManagement';
import { UserManagement } from '../components/settings/UserManagement';
import { UserProfile } from '../components/settings/UserProfile';
import { PageScroll, Screen, ScreenHeader, SegmentedControl } from '../components/common/ui';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types/entities';

export type SettingsTabKey = 'profile' | 'users' | 'apartments';

type SettingsScreenProps = {
  route?: {
    params?: {
      tab?: SettingsTabKey;
      hideTabSwitcher?: boolean;
    };
  };
};

const tabCopy: Record<SettingsTabKey, { title: string; description: string }> = {
  profile: {
    title: 'Your account',
    description: 'Your details, notifications, and this device.',
  },
  users: {
    title: 'People',
    description: 'Residents and guests, with their PINs, cards, and schedules.',
  },
  apartments: {
    title: 'Apartments',
    description: 'Apartments in this building.',
  },
};

export const SettingsScreen = ({ route }: SettingsScreenProps) => {
  const { user, token, updateUser } = useAuth();
  const requestedTab = route?.params?.tab ?? 'profile';
  const hideTabSwitcher = route?.params?.hideTabSwitcher ?? false;
  const [tab, setTab] = useState<SettingsTabKey>(requestedTab);

  const tabs = useMemo(() => {
    const base: Array<{ key: SettingsTabKey; label: string; icon: keyof typeof Feather.glyphMap }> = [
      { key: 'profile', label: 'Account', icon: 'user' },
      { key: 'users', label: 'People', icon: 'users' },
    ];

    if (user?.role === 'admin') {
      base.push({ key: 'apartments', label: 'Apartments', icon: 'home' });
    }

    return base;
  }, [user?.role]);

  useEffect(() => {
    setTab(requestedTab);
  }, [requestedTab]);

  if (!user || !token) {
    return null;
  }

  const activeTab = tabs.some((option) => option.key === tab) ? tab : 'profile';
  const copy = tabCopy[activeTab];

  const renderTab = () => {
    if (activeTab === 'profile') {
      return <UserProfile token={token} user={user} />;
    }

    if (activeTab === 'users') {
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
        <ScreenHeader eyebrow={hideTabSwitcher ? undefined : 'Settings'} title={copy.title} subtitle={copy.description} />
        {!hideTabSwitcher ? (
          <SegmentedControl
            options={tabs.map((option) => ({ key: option.key, label: option.label, icon: tabs.length < 3 ? option.icon : undefined }))}
            value={activeTab}
            onChange={setTab}
          />
        ) : null}
        {renderTab()}
      </PageScroll>
    </Screen>
  );
};
