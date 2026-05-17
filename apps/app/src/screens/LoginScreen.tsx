import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [autoAttempted, setAutoAttempted] = useState(false);

  const hasCode = useMemo(() => loginCode.trim().length > 0, [loginCode]);
  const showGmailShortcut = useMemo(
    () => Platform.OS !== 'web' && emailSent && email.trim().toLowerCase().endsWith('@gmail.com') && !!SENDER_EMAIL,
    [email, emailSent]
  );

  const exchangeCode = useCallback(
    async (code: string) => {
      const sanitizedCode = code.trim();
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
        setError(apiErrorMessage(nextError, 'Invalid or expired login code.'));
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
        setAutoAttempted(false);
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
        setAutoAttempted(false);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (autoAttempted) {
      return;
    }

    if (loginCode.trim() && email.trim()) {
      setAutoAttempted(true);
      exchangeCode(loginCode);
    }
  }, [loginCode, email, autoAttempted, exchangeCode]);

  const sendLoginCode = async () => {
    setError('');
    setStatus('');
    setSending(true);

    try {
      const response = await api.post('/auth/magic-links', { email: email.trim() });

      if (response.status === 202) {
        setEmailSent(true);
        setStatus('Login code sent. Check email and paste code.');
        return;
      }

      setError('Could not send login code.');
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to send login code.'));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setLoginCode('');
    setEmailSent(false);
    setError('');
    setStatus('');
    setAutoAttempted(false);
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
                <Feather name="lock" size={26} color={palette.primary} />
              </View>
              <Text style={screenStyles.title}>{APP_TITLE}</Text>
              <Text style={screenStyles.subtitle}>Sign in to manage apartment access.</Text>
            </View>

            <SectionCard title="Passwordless login">
              <View style={screenStyles.intro}>
                <Text style={screenStyles.introText}>
                  We will send a short login code to your email. No password required.
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <FieldLabel>Email</FieldLabel>
                <Input
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  nativeID="login-email"
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  value={email}
                />
              </View>

              {!emailSent ? (
                <Button
                  title="Send login code"
                  onPress={sendLoginCode}
                  loading={sending}
                  disabled={!email.trim()}
                  icon={<Feather name="send" size={18} color="#fff" />}
                  style={{ marginTop: 8 }}
                />
              ) : (
                <>
                  <View style={{ gap: 6, marginTop: 8 }}>
                    <FieldLabel>Login Code</FieldLabel>
                    <Input
                      accessibilityLabel="Login code"
                      autoCapitalize="none"
                      autoCorrect={false}
                      nativeID="login-code"
                      onChangeText={setLoginCode}
                      placeholder="Code received by email"
                      value={loginCode}
                    />
                  </View>
                  <Button
                    title="Login"
                    onPress={() => exchangeCode(loginCode)}
                    loading={exchanging}
                    disabled={!email.trim() || !hasCode}
                    icon={<Feather name="log-in" size={18} color="#fff" />}
                    style={{ marginTop: 8 }}
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
                    title="Start Over"
                    variant="ghost"
                    onPress={reset}
                    icon={<Feather name="refresh-cw" size={18} color={palette.primary} />}
                  />
                </>
              )}

              {status ? <Banner type="success" text={status} /> : null}
              {error ? <Banner type="error" text={error} /> : null}

              {emailSent ? (
                <Text style={[uiStyles.subtleText, { textAlign: 'center', marginTop: 8 }]}>
                  Didn't receive the email? Start over and try again.
                </Text>
              ) : null}
            </SectionCard>

            <View style={screenStyles.footer}>
              <Text style={screenStyles.serverText}>Server: {apiUrl}</Text>
              {Platform.OS !== 'web' ? (
                <Button
                  title="Change server URL"
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
    backgroundColor: palette.primarySoft,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    marginBottom: 8,
    width: 58,
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
  intro: {
    backgroundColor: palette.field,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  introText: {
    color: palette.muted,
    fontSize: 15,
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
