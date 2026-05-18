import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ApartmentManagement } from '../components/settings/ApartmentManagement';
import { UserManagement } from '../components/settings/UserManagement';
import { UserProfile } from '../components/settings/UserProfile';
import { Button, PageScroll, Screen, SectionCard, palette, styles as uiStyles } from '../components/common/ui';
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
    title: 'Profile',
    description: 'Manage your account, API keys, and session.',
  },
  users: {
    title: 'Users',
    description: 'Manage residents, guests, PINs, RFID tags, and schedules.',
  },
  apartments: {
    title: 'Apartments',
    description: 'Manage apartment configuration.',
  },
};

export const SettingsScreen = ({ route }: SettingsScreenProps) => {
  const { user, token, updateUser } = useAuth();
  const requestedTab = route?.params?.tab ?? 'profile';
  const hideTabSwitcher = route?.params?.hideTabSwitcher ?? false;
  const [tab, setTab] = useState<SettingsTabKey>(requestedTab);

  const tabs = useMemo(() => {
    const base: Array<{ key: SettingsTabKey; label: string; icon: keyof typeof Feather.glyphMap }> = [
      { key: 'profile', label: 'Profile', icon: 'user' },
      { key: 'users', label: 'Users', icon: 'users' },
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
  const copy = hideTabSwitcher ? tabCopy[activeTab] : {
    title: 'Settings',
    description: 'Manage your profile, residents, and apartment configuration.',
  };

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
        <SectionCard>
          <View style={screenStyles.header}>
            <View>
              <Text style={screenStyles.eyebrow}>Workspace</Text>
              <Text style={screenStyles.title}>{copy.title}</Text>
            </View>
            <View style={screenStyles.roleBadge}>
              <Feather name="shield" size={14} color={palette.primary} />
              <Text style={screenStyles.roleText}>{user.role}</Text>
            </View>
          </View>
          <Text style={[uiStyles.subtleText, screenStyles.description]}>{copy.description}</Text>
          {!hideTabSwitcher ? (
            <View style={screenStyles.tabs}>
              {tabs.map((option) => {
                const isSelected = activeTab === option.key;
                return (
                  <Button
                    key={option.key}
                    title={option.label}
                    variant={isSelected ? 'primary' : 'secondary'}
                    onPress={() => setTab(option.key)}
                    icon={<Feather name={option.icon} size={18} color={isSelected ? '#fff' : palette.text} />}
                    style={screenStyles.tabButton}
                  />
                );
              })}
            </View>
          ) : null}
        </SectionCard>
        {renderTab()}
      </PageScroll>
    </Screen>
  );
};

const screenStyles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  roleBadge: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  roleText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  description: {
    marginBottom: 4,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabButton: {
    borderRadius: 8,
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
