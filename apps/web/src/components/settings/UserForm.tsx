import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Alert, Modal } from 'react-bootstrap';
import axios from 'axios';
import { User, Apartment } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { FaTrash } from 'react-icons/fa';

interface UserFormProps {
    targetUser: User | null;
    onSuccess: (updatedUser: User | null) => void;
}

const UserForm: React.FC<UserFormProps> = ({ targetUser, onSuccess }) => {
    const { token, user } = useAuth();
    const [name, setName] = useState(targetUser?.name || '');
    const [email, setEmail] = useState(targetUser?.email || '');
    const [apartmentNumber, setApartmentNumber] = useState(targetUser?.apartment?.number || user?.apartment?.number || '');
    type UserRole = 'admin' | 'apartment_admin' | 'guest';
    const [role, setRole] = useState<UserRole>(targetUser?.role || 'guest');
    const [status, setStatus] = useState('');
    const [apartments, setApartments] = useState<Apartment[]>([]);
    const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
    const [pendingRole, setPendingRole] = useState<string | null>(null);

    const fetchApartments = useCallback(async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/apartments`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setApartments(response.data);
        } catch (error) {
            console.error('Failed to fetch apartments:', error);
            setStatus('Failed to fetch apartments. Please try again.');
        }
    }, [token]);

    useEffect(() => {
        fetchApartments();
    }, [fetchApartments]);

    useEffect(() => {
        if (targetUser) {
            setName(targetUser.name);
            if (targetUser.email) {
                setEmail(targetUser.email);
            }
            setApartmentNumber(targetUser.apartment?.number || '');
            setRole(targetUser.role);
        } else {
            // For new users, set the apartment number to the current user's apartment
            setApartmentNumber(user?.apartment?.number || '');
            // Set default role for new users
            setRole('guest');
        }
    }, [targetUser, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('');

        try {
            const updatedUserData = { name, email, apartment: { number: apartmentNumber }, role };
            let response;

            if (targetUser) {
                response = await axios.put(
                    `${process.env.NEXT_PUBLIC_API_URL}/users/${targetUser.id}`,
                    updatedUserData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } else {
                response = await axios.post(
                    `${process.env.NEXT_PUBLIC_API_URL}/users`,
                    updatedUserData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }

            if (response.status === 200 || response.status === 201) {
                setStatus('User updated successfully');
                onSuccess(response.data.user);
            } else {
                throw new Error('Failed to update user');
            }
        } catch (error) {
            setStatus('Failed to update user');
            console.error('Error updating user:', error);
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`Are you sure you want to delete ${user.name}?`)) {
            return;
        }

        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            onSuccess(null);
        } catch (error) {
            console.error('Failed to delete user:', error);
            setStatus('Failed to delete user');
        }
    };

    const handleRoleChange = (newRole: string) => {
        // Show confirmation if admin is downgrading themselves
        if (targetUser?.id === user?.id && user?.role === 'admin' && newRole !== 'admin') {
            setPendingRole(newRole);
            setShowDowngradeConfirm(true);
        } else {
            setRole(newRole as UserRole);
        }
    };

    const confirmDowngrade = () => {
        if (pendingRole) {
            setRole(pendingRole as UserRole);
            setPendingRole(null);
        }
        setShowDowngradeConfirm(false);
    };

    return (
        <>
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                    <Form.Label>Name</Form.Label>
                    <Form.Control
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </Form.Group>
                <Form.Group controlId="apartmentSelect" className="mb-3">
                    <Form.Label>Apartment</Form.Label>
                    <Form.Control
                        as="select"
                        value={apartmentNumber}
                        onChange={(e) => setApartmentNumber(e.target.value)}
                        required
                        disabled={user?.role !== 'admin'}
                        aria-label="Select apartment"
                    >
                        <option value="">Select an apartment</option>
                        {apartments.map((apartment: Apartment) => (
                            <option
                                key={apartment.id}
                                value={apartment.number}
                            >
                                {apartment.number}
                            </option>
                        ))}
                    </Form.Control>
                </Form.Group>
                {user?.role === 'admin' && (
                    <Form.Group className="mb-3">
                        <Form.Label>Role</Form.Label>
                        <Form.Control
                            as="select"
                            value={role}
                            onChange={(e) => handleRoleChange(e.target.value)}
                            required
                            aria-label="Select user role"
                        >
                            <option value="guest">Guest</option>
                            <option value="apartment_admin">Apartment Admin</option>
                            <option value="admin">Admin</option>
                        </Form.Control>
                    </Form.Group>
                )}
                {targetUser && (
                    <Button 
                        variant="outline-danger" 
                        onClick={() => handleDeleteUser(targetUser)}
                        className="me-2"
                    >
                        <FaTrash className="me-1" />Delete User
                    </Button>
                )}
                <Button variant="primary" type="submit">
                    {targetUser ? 'Update User' : 'Add User'}
                </Button>
                {status && <Alert className="mt-3" variant={status.includes('successfully') ? 'success' : 'danger'}>{status}</Alert>}
            </Form>

            <Modal show={showDowngradeConfirm} onHide={() => setShowDowngradeConfirm(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Warning: Role Downgrade</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>You are about to downgrade your own admin role. This action cannot be reversed without another admin upgrading your role again or a direct access to the database.</p>
                    <p>Are you sure you want to continue?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDowngradeConfirm(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDowngrade}>
                        Yes, Downgrade My Role
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default UserForm;
