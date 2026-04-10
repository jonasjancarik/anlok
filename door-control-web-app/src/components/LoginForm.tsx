import { useState, useEffect, useCallback } from 'react';
import { Form, Button, Container, Row, Col, Spinner } from 'react-bootstrap';
import { useRouter } from 'next/router';
import axios from 'axios';
import { AxiosError } from 'axios';
import { User } from '@/types/types';

const LoginForm = ({ onLogin }: { onLogin: (token: string, user: User) => void }) => {
    const [email, setEmail] = useState('');
    const [loginCode, setLoginCode] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [emailStatus, setEmailStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [loginFailed, setLoginFailed] = useState(false);

    const router = useRouter();

    const handleLogin = useCallback(async (code: string | null = null) => {
        try {
            // Use the provided code or fallback to the state value
            const loginCodeToUse = code || loginCode;
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/tokens`, { 
                login_code: loginCodeToUse,
                email: email
            });
            if (response.status === 201) {
                onLogin(response.data.access_token, response.data.user);
            } else {
                setEmailStatus('Failed to login.');
                setLoginFailed(true);
            }
        } catch (error) {
            if (error instanceof AxiosError) {
                if (error.response?.status === 400) {
                    setEmailStatus('Invalid login code.');
                } else if (error.response?.status === 401) {
                    setEmailStatus('Invalid or expired login code.');
                } else {
                    setEmailStatus('Failed to connect to the API.');
                }
            } else {
                setEmailStatus('Failed to connect to the API.');
            }
            setLoginFailed(true);
        }
    }, [loginCode, onLogin, email]);

    useEffect(() => {
        console.log(process.env)
        const { login_code } = router.query;
        if (login_code) {
            setLoginCode(login_code as string);
            handleLogin(login_code as string); // Automatically send the exchange code request
        }
    }, [router.query, handleLogin]);

    const handleSendLink = async () => {
        setLoading(true);
        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/magic-links`, { email });
            if (response.status === 202) {
                setEmailStatus('A login code has been sent to your email.');
                setEmailSent(true);
            } else {
                setEmailStatus('Failed to send email.');
            }
        } catch (error) {
            if (error instanceof AxiosError) {
                if (error.response?.status === 422) {
                    setEmailStatus('Invalid email address.');
                } else if (error.response) {
                    setEmailStatus('An error occurred: ' + error.response?.data.error.detail);
                } else if (error.message === 'Network Error') {
                    setEmailStatus('That didn\'t work :( Either the server is down or you are offline.');
                } else {
                    setEmailStatus('An unexpected error occurred');
                }
            } else {
                setEmailStatus('Failed to connect to the API.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStartOver = () => {
        // setEmail('');
        setLoginCode('');
        setEmailSent(false);
        setEmailStatus('');
        setLoginFailed(false);
    };

    return (
        <Container>
            <Row className="justify-content-center">
                <Col xs={12} sm={10} lg={4}>
                    <Form className="text-center">
                        {!emailSent ? (
                            <>
                                <Form.Group controlId="email-input" className="mb-2">
                                    <Form.Control
                                        type="email"
                                        className='text-center'
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={loading}
                                    />
                                </Form.Group>
                                <Button variant="secondary" onClick={handleSendLink} className="w-100" disabled={loading}>
                                    {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Send Login Code'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Form.Group controlId="login-code-input" className="mb-2">
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter login code"
                                        value={loginCode}
                                        className='text-center'
                                        onChange={(e) => setLoginCode(e.target.value)}
                                    />
                                </Form.Group>
                                <Button variant="secondary" onClick={() => handleLogin()} disabled={!loginCode} className="w-100">
                                    Login
                                </Button>
                                {loginFailed && (
                                    <Button variant="link" onClick={handleStartOver} className="mt-2">
                                        Start Over
                                    </Button>
                                )}
                            </>
                        )}
                        {emailStatus && <div className="mt-3">{emailStatus}</div>}
                        {emailSent && email.endsWith('@gmail.com') && process.env.NEXT_SENDER_EMAIL && <a href={`https://mail.google.com/mail/u/0/#search/from%3A(${process.env.NEXT_SENDER_EMAIL})+in%3Aanywhere+newer_than%3A1h/`} target="_blank">Open Gmail</a>}
                        {emailSent && <div className='mt-2'>Didn&apos;t receive the email? <a onClick={handleStartOver} className="text-decoration-none">
                            Try again.
                        </a></div>}
                    </Form>
                </Col>
            </Row>
        </Container>
    );
};

export default LoginForm;
