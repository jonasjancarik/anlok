import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { api, apiErrorMessage } from '../lib/api';
import { APP_TITLE } from '../lib/config';
import { AuthTokenResponse } from '../types/entities';
import { Banner, Button, FieldLabel, Input, PageScroll, Screen, SectionCard, styles as uiStyles } from '../components/common/ui';

export const LoginScreen = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [autoAttempted, setAutoAttempted] = useState(false);

  const hasCode = useMemo(() => loginCode.trim().length > 0, [loginCode]);

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

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <PageScroll>
          <SectionCard title={APP_TITLE}>
            <Text style={[uiStyles.subtleText, { fontSize: 15 }]}>
              Passwordless login by email code.
            </Text>
            <View style={{ gap: 6 }}>
              <FieldLabel>Email</FieldLabel>
              <Input
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
              />
            </View>
            {!emailSent ? (
              <Button
                title="Send Login Code"
                onPress={sendLoginCode}
                loading={sending}
                disabled={!email.trim()}
              />
            ) : (
              <>
                <View style={{ gap: 6 }}>
                  <FieldLabel>Login Code</FieldLabel>
                  <Input
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={loginCode}
                    onChangeText={setLoginCode}
                    placeholder="Paste code"
                  />
                </View>
                <Button
                  title="Login"
                  onPress={() => exchangeCode(loginCode)}
                  loading={exchanging}
                  disabled={!email.trim() || !hasCode}
                />
                <Button title="Start Over" variant="ghost" onPress={reset} />
              </>
            )}
            {status ? <Banner type="success" text={status} /> : null}
            {error ? <Banner type="error" text={error} /> : null}
          </SectionCard>
        </PageScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
};
