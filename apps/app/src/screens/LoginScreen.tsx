import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useServerConfig } from '../contexts/ServerConfigContext';
import { api, apiErrorMessage } from '../lib/api';
import { APP_TITLE, SENDER_EMAIL } from '../lib/config';
import { AuthTokenResponse } from '../types/entities';
import { Banner, Button, FieldLabel, Input, PageScroll, Screen, SectionCard, styles as uiStyles, palette } from '../components/common/ui';

export const LoginScreen = () => {
  const { login } = useAuth();
  const navigation = useNavigation<any>();
  const { apiUrl } = useServerConfig();
  const [email, setEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const autoAttemptedRef = useRef(false);

  const hasCode = useMemo(() => loginCode.trim().length > 0, [loginCode]);
  const showGmailShortcut = useMemo(
    () => Platform.OS !== 'web' && emailSent && email.trim().toLowerCase().endsWith('@gmail.com') && !!SENDER_EMAIL,
    [email, emailSent]
  );

  const exchangeCode = useCallback(
    async (code: string) => {
      const sanitizedCode = code.trim().toUpperCase();
      if (!sanitizedCode || !email.trim()) {
        return;
      }

      setExchanging(true);
      setError('');
      setStatus('');

      try {
        const response = await api.post<AuthTokenResponse>('/auth/tokens', {
          login_code: sanitizedCode,
          email: email.trim(),
        });

        if (response.status === 201) {
          await login(response.data.access_token, response.data.user);
          return;
        }

        setError('Login failed.');
      } catch (nextError) {
        setError(apiErrorMessage(nextError, 'That code didn’t work. It may have expired, so request a new one.'));
      } finally {
        setExchanging(false);
      }
    },
    [email, login]
  );

  useEffect(() => {
    const maybeReadCodeFromUrl = async () => {
      const initial = await Linking.getInitialURL();
      if (!initial) {
        return;
      }

      const { queryParams } = Linking.parse(initial);
      const code = queryParams?.login_code;
      const mail = queryParams?.email;

      if (typeof mail === 'string') {
        setEmail(mail);
      }

      if (typeof code === 'string') {
        setLoginCode(code);
        setEmailSent(true);
        autoAttemptedRef.current = false;
      }
    };

    maybeReadCodeFromUrl();

    const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
      const { queryParams } = Linking.parse(url);
      const code = queryParams?.login_code;
      const mail = queryParams?.email;

      if (typeof mail === 'string') {
        setEmail(mail);
      }

      if (typeof code === 'string') {
        setLoginCode(code);
        setEmailSent(true);
        autoAttemptedRef.current = false;
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (autoAttemptedRef.current) {
      return;
    }

    if (loginCode.trim() && email.trim()) {
      autoAttemptedRef.current = true;
      exchangeCode(loginCode);
    }
  }, [loginCode, email, exchangeCode]);

  const sendLoginCode = async () => {
    setError('');
    setStatus('');
    setSending(true);

    try {
      const response = await api.post('/auth/magic-links', { email: email.trim() });

      if (response.status === 202) {
        setEmailSent(true);
        setStatus(`Check your inbox. We sent a sign-in code to ${email.trim()}.`);
        return;
      }

      setError('Couldn’t send a sign-in code. Try again.');
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Couldn’t send a sign-in code. Try again.'));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setLoginCode('');
    setEmailSent(false);
    setError('');
    setStatus('');
    autoAttemptedRef.current = false;
  };

  const openGmail = useCallback(async () => {
    const webSearchUrl = `https://mail.google.com/mail/u/0/#search/from%3A(${encodeURIComponent(
      SENDER_EMAIL
    )})+in%3Aanywhere+newer_than%3A1h/`;

    try {
      await Linking.openURL('googlegmail://');
      return;
    } catch {
      await Linking.openURL(webSearchUrl);
    }
  }, []);

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <PageScroll>
          <View style={screenStyles.shell}>
            <View style={screenStyles.hero}>
              <View style={screenStyles.mark}>
                <Feather name="lock" size={28} color="#fff" />
              </View>
              <Text style={screenStyles.title}>{APP_TITLE}</Text>
              <Text style={screenStyles.subtitle}>Open the door and manage access from your phone.</Text>
            </View>

            <SectionCard
              title={emailSent ? 'Enter your code' : 'Sign in'}
              description={emailSent ? undefined : 'We’ll email you a short sign-in code. No password needed.'}
            >

              <View style={{ gap: 6 }}>
                <FieldLabel>Email</FieldLabel>
                <Input
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  nativeID="login-email"
                  editable={!emailSent}
                  onChangeText={setEmail}
                  onSubmitEditing={() => {
                    if (!emailSent && email.trim()) void sendLoginCode();
                  }}
                  returnKeyType="send"
                  style={emailSent ? { color: palette.muted } : undefined}
                  placeholder="name@example.com"
                  value={email}
                />
              </View>

              {!emailSent ? (
                <Button
                  title="Email me a code"
                  onPress={sendLoginCode}
                  loading={sending}
                  disabled={!email.trim()}
                  icon={<Feather name="send" size={18} color="#fff" />}
                />
              ) : (
                <>
                  {status ? <Banner type="success" text={status} /> : null}
                  <View style={{ gap: 6 }}>
                    <FieldLabel>Sign-in code</FieldLabel>
                    <Input
                      accessibilityLabel="Sign-in code"
                      autoCapitalize="characters"
                      autoComplete="one-time-code"
                      autoCorrect={false}
                      autoFocus
                      keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'visible-password'}
                      maxLength={12}
                      nativeID="login-code"
                      onChangeText={setLoginCode}
                      onSubmitEditing={() => {
                        if (hasCode) void exchangeCode(loginCode);
                      }}
                      returnKeyType="go"
                      placeholder="Code from the email"
                      value={loginCode}
                    />
                  </View>
                  <Button
                    title="Sign in"
                    onPress={() => exchangeCode(loginCode)}
                    loading={exchanging}
                    disabled={!email.trim() || !hasCode}
                    icon={<Feather name="log-in" size={18} color="#fff" />}
                    style={{ marginTop: 4 }}
                  />
                  {showGmailShortcut ? (
                    <Button
                      title="Open Gmail"
                      variant="secondary"
                      onPress={() => void openGmail()}
                      icon={<Feather name="mail" size={18} color={palette.text} />}
                    />
                  ) : null}
                  <Button
                    title="Use a different email"
                    variant="ghost"
                    onPress={reset}
                    icon={<Feather name="refresh-cw" size={18} color={palette.primary} />}
                  />
                </>
              )}

              {error ? <Banner type="error" text={error} /> : null}

              {emailSent ? (
                <Text style={[uiStyles.subtleText, { textAlign: 'center' }]}>
                  No email? Check your spam folder, or use a different address.
                </Text>
              ) : null}
            </SectionCard>

            <View style={screenStyles.footer}>
              <Text style={screenStyles.serverText}>Server: {apiUrl}</Text>
              {Platform.OS !== 'web' ? (
                <Button
                  title="Change server"
                  variant="ghost"
                  onPress={() => navigation.navigate('ServerSetup')}
                  icon={<Feather name="server" size={16} color={palette.primary} />}
                />
              ) : null}
            </View>
          </View>
        </PageScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const screenStyles = StyleSheet.create({
  shell: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 520,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 34,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 20,
    height: 64,
    justifyContent: 'center',
    marginBottom: 8,
    width: 64,
  },
  title: {
    color: palette.text,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: 14,
  },
  serverText: {
    color: palette.muted,
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
});
