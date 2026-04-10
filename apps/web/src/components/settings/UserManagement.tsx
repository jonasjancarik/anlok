import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Alert, Card, Badge } from 'react-bootstrap';
import axios from 'axios';
import PinManagement from './PinManagement';
import RfidManagement from './RfidManagement';
import ScheduleManagement from './ScheduleManagement';
import { User, Apartment } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import UserForm from './UserForm';
import { FaKey, FaTag, FaCalendarAlt, FaTrash, FaEdit, FaUserPlus, FaToggleOn, FaToggleOff } from 'react-icons/fa';

interface UserManagementProps { isActive: boolean; }

const UserManagement: React.FC<UserManagementProps> = ({ isActive }): JSX.Element => {
    const { token, user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [showRfidModal, setShowRfidModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', apartment_number: '', role: 'apartment_admin' });
    const [error, setError] = useState('');
    const [modalError, setModalError] = useState('');
    const [apartments, setApartments] = useState([]);
    const [showGuestScheduleModal, setShowGuestScheduleModal] = useState(false);
    const [success, setSuccess] = useState('');

    const fetchApartments = useCallback(async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/apartments`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setApartments(response.data);
        } catch (error) {
            console.error('Failed to fetch apartments:', error);
            setError('Failed to fetch apartments. Please try again.');
        }
    }, [token]);

    const fetchUsers = useCallback(async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            let usersData = currentUser?.role === 'admin' ? response.data : response.data.filter((u: User) => u.apartment?.number === currentUser?.apartment?.number);
            
            // Sort users by apartment number (numerically if possible) and then by name
            usersData.sort((a: User, b: User) => {
                const aNumber = parseInt(a.apartment.number, 10);
                const bNumber = parseInt(b.apartment.number, 10);

                if (!isNaN(aNumber) && !isNaN(bNumber)) {
                    if (aNumber === bNumber) {
                        return a.name.localeCompare(b.name);
                    }
                    return aNumber - bNumber;
                } else {
                    if (a.apartment.number === b.apartment.number) {
                        return a.name.localeCompare(b.name);
                    }
                    return a.apartment.number.localeCompare(b.apartment.number);
                }
            });

            setUsers(usersData);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            if (error instanceof Error && 'response' in error) {
                const axiosError = error as { response?: { data?: { detail?: string } } };
                if (axiosError.response?.data?.detail) {
                    setError(axiosError.response.data.detail);
                } else {
                    setError('Failed to fetch users. Please try again.');
                }
            } else {
                setError('Failed to fetch users. Please try again.');
            }
        }
    }, [token, currentUser?.role, currentUser?.apartment?.number]);

    useEffect(() => {
        fetchApartments();
        fetchUsers();
    }, [fetchApartments, fetchUsers]);

    useEffect(() => {
        if (isActive) {
            fetchUsers();
            fetchApartments();
        }
    }, [isActive, fetchUsers, fetchApartments]);

    const handlePinManagement = (user: User) => {
        setSelectedUser(user);
        setShowPinModal(true);
    };

    const handleRfidManagement = (user: User) => {
        setSelectedUser(user);
        setShowRfidModal(true);
    };

    const handleAddUser = () => {
        setSelectedUser(null);
        setNewUser({ name: '', email: '', apartment_number: '', role: 'apartment_admin' });
        fetchApartments(); // Refresh the apartments list
        setShowUserModal(true);
    };

    const handleEditUser = (user: User) => {
        setSelectedUser(user);
        setShowUserModal(true);
    };

    const handleGuestScheduleManagement = (user: User) => {
        setSelectedUser(user);
        setShowGuestScheduleModal(true);
    };

    const handleUserSuccess = (updatedUser: User | null) => {
        setShowUserModal(false);
        fetchUsers();
        setSuccess(updatedUser ? 'User updated successfully' : 'User added successfully');
    };

    const handleToggleUserStatus = async (userId: number, currentIsActive: boolean) => {
        setError('');
        setSuccess('');
        try {
            await axios.put(
                `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`,
                { is_active: !currentIsActive },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setUsers((prevUsers): User[] =>
                prevUsers.map((u: User): User =>
                    u.id === userId ? { ...u, is_active: !currentIsActive } : u
                )
            );
            setSuccess(`User ${!currentIsActive ? 'activated' : 'deactivated'} successfully.`);
        } catch (error) {
            console.error('Failed to update user status:', error);
            if (error instanceof Error && 'response' in error) {
                const axiosError = error as { response?: { data?: { detail?: string } } };
                setError(axiosError.response?.data?.detail || 'Failed to update user status.');
            } else {
                setError('Failed to update user status. An unknown error occurred.');
            }
        }
    };

    return (
        <div>
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            <Button variant="primary" onClick={handleAddUser} className="mb-3">
                <FaUserPlus className="me-2" />Add User
            </Button>
            
            {(() => {
                const usersByApartment = users.reduce((acc: { [key: string]: User[] }, user: User) => {
                    const apartmentNumber = user.apartment.number;
                    if (!acc[apartmentNumber]) {
                        acc[apartmentNumber] = [];
                    }
                    acc[apartmentNumber].push(user);
                    return acc;
                }, {});

                return Object.entries(usersByApartment).map(([apartmentNumber, users]) => (
                    <div key={apartmentNumber}>
                        <h4>Apartment {apartmentNumber}</h4>
                        <div className="d-flex flex-wrap mb-3">
                            {users.map((u: User) => (
                                <Card 
                                    key={u.id} 
                                    className="me-2 mb-2 flex-grow-1 flex-sm-grow-0" 
                                    style={{
                                        minWidth: '280px', 
                                        opacity: u.is_active ? 1 : 0.6, 
                                        transition: 'opacity 0.3s ease-in-out' 
                                    } as React.CSSProperties}
                                >
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <div className="d-flex align-items-center">
                                                <Form.Check
                                                    type="switch"
                                                    id={`user-active-switch-${u.id}`}
                                                    checked={u.is_active}
                                                    onChange={() => handleToggleUserStatus(u.id, u.is_active)}
                                                    className="me-2"
                                                    disabled={currentUser?.role === 'apartment_admin' && u.role === 'admin'}
                                                />
                                                <Card.Title className="mb-0">{u.name}</Card.Title>
                                            </div>
                                            <Button 
                                                variant="link" 
                                                size="sm" 
                                                onClick={() => handleEditUser(u)} 
                                                className="p-0 text-muted"
                                            >
                                                <FaEdit style={{ position: 'relative', top: '-1px' }}/>
                                            </Button>
                                        </div>
                                        <div className="mb-2 d-flex align-items-center">
                                            <Badge bg={
                                                u.role === 'admin' ? 'danger' :
                                                u.role === 'apartment_admin' ? 'primary' :
                                                'secondary'
                                            } className="me-2">
                                                {u.role === 'apartment_admin' ? 'Apartment Admin' :
                                                 u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                                            </Badge>
                                        </div>
                                        <p className="mb-2 text-muted">{u.email || 'No email'}</p>
                                        <div className="d-flex flex-wrap">
                                            <Button variant="outline-primary" size="sm" onClick={() => handlePinManagement(u)} className="me-2 mb-2">
                                                <FaKey className="me-1" />PINs
                                            </Button>
                                            <Button variant="outline-secondary" size="sm" onClick={() => handleRfidManagement(u)} className="me-2 mb-2">
                                                <FaTag className="me-1" />Fobs
                                            </Button>
                                            {u.role === 'guest' && (
                                                <Button variant="outline-info" size="sm" onClick={() => handleGuestScheduleManagement(u)} className="me-2 mb-2">
                                                    <FaCalendarAlt className="me-1" />Schedule
                                                </Button>
                                            )}
                                        </div>
                                    </Card.Body>
                                </Card>
                            ))}
                        </div>
                    </div>
                ));
            })()}

            <Modal show={showPinModal} onHide={() => setShowPinModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>PINs - {selectedUser?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedUser ? (
                        <PinManagement user={selectedUser} />
                    ) : (
                        <p>No user selected</p>
                    )}
                </Modal.Body>
            </Modal>

            <Modal show={showRfidModal} onHide={() => setShowRfidModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Key fobs - {selectedUser?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedUser ? (
                        <RfidManagement user={selectedUser} />
                    ) : (
                        <p>No user selected</p>
                    )}
                </Modal.Body>
            </Modal>

            <Modal show={showUserModal} onHide={() => setShowUserModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>{selectedUser ? 'Edit User' : 'Add New User'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <UserForm
                        targetUser={selectedUser}
                        onSuccess={handleUserSuccess}
                    />
                </Modal.Body>
            </Modal>

            <Modal show={showGuestScheduleModal} onHide={() => setShowGuestScheduleModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Schedule - {selectedUser?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedUser ? (
                        <ScheduleManagement user={selectedUser} />
                    ) : (
                        <p>No user selected</p>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default UserManagement;
