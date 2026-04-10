import UnlockButton from '../components/UnlockButton';
import { Container } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const Home = () => {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (router.query['unlock-now'] !== undefined && user) {
            // Find the UnlockButton component and trigger its handleUnlock function
            const unlockButton = document.querySelector('#unlock-button-container button');
            if (unlockButton) {
                (unlockButton as HTMLButtonElement).click();
                // Remove the query parameter
                router.replace('/', undefined, { shallow: true });
            }
        }
    }, [router, user]);

    if (!user) {
        return null; // This should never happen due to AuthWrapper
    }

    return (
        <Container className="d-flex flex-grow-1 flex-column justify-content-center align-items-center h-100">
            <UnlockButton />
        </Container>
    );
};

export default Home;
