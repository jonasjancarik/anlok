import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import axios, { AxiosError } from 'axios';
import { Alert, Button, Card, Container, Spinner } from 'react-bootstrap';

import LoginForm from '@/components/LoginForm';
import { useAuth } from '@/contexts/AuthContext';
import { safeInternalPath } from '@/lib/navigation';
import { User } from '@/types/types';

interface AuthorizationRequest {
    client_name: string;
    scope: string;
    resource: string;
}

const AuthorizeMcp = () => {
    const router = useRouter();
    const { user, token, login, loading: authLoading } = useAuth();
    const [request, setRequest] = useState<AuthorizationRequest | null>(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const requestId = typeof router.query.request_id === 'string' ? router.query.request_id : '';
    const returnTo = useMemo(
        () => safeInternalPath(
            requestId ? `/oauth/authorize?request_id=${encodeURIComponent(requestId)}` : '/oauth/authorize',
            '/oauth/authorize',
        ),
        [requestId],
    );

    useEffect(() => {
        if (!router.isReady) {
            return;
        }
        if (!requestId) {
            setError('This connection request is missing or invalid.');
            return;
        }
        if (!user || !token) {
            return;
        }

        setError('');
        axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/oauth/authorization-requests/${encodeURIComponent(requestId)}`,
            { headers: { Authorization: `Bearer ${token}` } },
        ).then((response) => {
            setRequest(response.data);
        }).catch((caught: AxiosError<{ error_description?: string }>) => {
            setError(caught.response?.data?.error_description || 'This connection request is invalid or has expired.');
        });
    }, [requestId, router.isReady, token, user]);

    const handleLogin = (newToken: string, loggedInUser: User) => {
        login(newToken, loggedInUser);
    };

    const decide = async (decision: 'approve' | 'deny') => {
        if (!token || !requestId) {
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/oauth/authorization-requests/${encodeURIComponent(requestId)}`,
                { decision },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            window.location.assign(response.data.redirect_uri);
        } catch (caught) {
            const axiosError = caught as AxiosError<{ error_description?: string }>;
            setError(axiosError.response?.data?.error_description || 'Anlok could not complete this connection request.');
            setSubmitting(false);
        }
    };

    if (authLoading || (user && !request && !error)) {
        return (
            <Container className="d-flex justify-content-center align-items-center vh-100">
                <Spinner animation="border" role="status"><span className="visually-hidden">Loading</span></Spinner>
            </Container>
        );
    }

    return (
        <Container className="d-flex justify-content-center align-items-center vh-100 px-3">
            <Card style={{ maxWidth: '34rem' }} className="w-100 shadow-sm">
                <Card.Body className="p-4">
                    <h1 className="h3 mb-3">Connect to Anlok</h1>
                    {!user ? (
                        <>
                            <p className="text-body-secondary mb-4">
                                Sign in with your Anlok email to review this connection request.
                            </p>
                            <LoginForm onLogin={handleLogin} returnTo={returnTo} />
                        </>
                    ) : error ? (
                        <Alert variant="danger" className="mb-0">{error}</Alert>
                    ) : request ? (
                        <>
                            <p>
                                <strong>{request.client_name}</strong> wants to use Anlok on your behalf.
                            </p>
                            <p className="text-body-secondary">
                                It will only see and change the residents, credentials, schedules, and door controls
                                already available to your Anlok account. Physical actions and sensitive changes still
                                require confirmation.
                            </p>
                            <p className="small text-body-secondary mb-4">
                                Signed in as {user.email || user.name}
                            </p>
                            <div className="d-flex gap-2 justify-content-end">
                                <Button variant="outline-secondary" disabled={submitting} onClick={() => decide('deny')}>
                                    Cancel
                                </Button>
                                <Button variant="primary" disabled={submitting} onClick={() => decide('approve')}>
                                    {submitting ? 'Connecting…' : 'Allow connection'}
                                </Button>
                            </div>
                        </>
                    ) : null}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default AuthorizeMcp;
