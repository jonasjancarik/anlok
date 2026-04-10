import { useEffect } from 'react';
import { useRouter } from 'next/router';
import LoginForm from '../components/LoginForm';
import { Container } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types/types';

const Login = () => {
    const router = useRouter();
    const { user, login } = useAuth();

    useEffect(() => {
        if (user) {
            router.push('/');
        }
    }, [user, router]);

    const handleLogin = (token: string, user: User) => {
        login(token, user);
        router.push('/');
    };

    return (
        <Container className="d-flex flex-column justify-content-center align-items-center vh-100">
            <LoginForm onLogin={handleLogin} />
        </Container>
    );
};

export default Login;