import React from 'react';
import { Button } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import UserForm from './UserForm';
import ApiKeyManagement from './ApiKeyManagement';
import { User } from '@/types/types';

const UserProfile: React.FC = () => {
    const { logout, user, updateUser } = useAuth();
    const router = useRouter();

    const handleSuccess = (user: User | null) => {
        if (user) {
            updateUser(user);
        }
    };

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    return (
        <div className="row">
            <div className="col-12 col-md-10 col-lg-8 col-xl-6">
                <div className="card">
                    <div className="card-body p-4">
                        <UserForm targetUser={user} onSuccess={handleSuccess} />

                        {user?.role === 'admin' && (
                            <div className="mt-4">
                                <h3>API Keys</h3>
                                <p className="text-muted">
                                    Manage your API keys here. API keys can be used to connect other apps and services to your account.
                                </p>
                                <ApiKeyManagement />
                            </div>
                        )}

                        <div className="mt-4 text-center">
                            <Button variant="danger" onClick={handleLogout}>
                                Logout
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
