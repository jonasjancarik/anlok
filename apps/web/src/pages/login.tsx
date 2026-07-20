import { useEffect } from 'react';
import { useRouter } from 'next/router';
import LoginForm from '../components/LoginForm';
import { Container } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types/types';

const Login = () => {
    const router = useRouter();
    const { user, login } = useAuth();
    const requestedReturnTo = typeof router.query.return_to === 'string' ? router.query.return_to : '';
    const returnTo = requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//')
        ? requestedReturnTo
        : '/';

    useEffect(() => {
        if (user) {
            router.push(returnTo);
        }
    }, [user, router, returnTo]);

    const handleLogin = (token: string, user: User) => {
        login(token, user);
        router.push(returnTo);
    };

    return (
        <Container className="d-flex flex-column justify-content-center align-items-center vh-100">
            <LoginForm onLogin={handleLogin} returnTo={returnTo} />
        </Container>
    );
};

export default Login;
