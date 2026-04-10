import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Modal, Toast, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { User, RFID } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { MdAdd } from 'react-icons/md';


interface RfidManagementProps {
    user: User;
}

const RfidManagement: React.FC<RfidManagementProps> = ({ user }) => {
    const { token } = useAuth();
    const [rfidTags, setRfidTags] = useState<RFID[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRfid, setSelectedRfid] = useState<RFID | null>(null);
    
    const [newRfidUuid, setNewRfidUuid] = useState('');
    const [newRfidLabel, setNewRfidLabel] = useState('');
    const [isReading, setIsReading] = useState(false);
    
    const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

    const fetchRfidTags = useCallback(async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/rfids`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setRfidTags(response.data);
        } catch (error) {
            console.error('Failed to fetch RFID tags:', error);
            setToast({ show: true, message: 'Failed to fetch RFID tags', variant: 'danger' });
        } finally {
            setIsLoading(false);
        }
    }, [user.id, token]);

    useEffect(() => {
        fetchRfidTags();
    }, [user, fetchRfidTags]);

    const handleAddRfid = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/rfids`, {
                uuid: newRfidUuid,
                label: newRfidLabel,
                user_id: user.id,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            setToast({ show: true, message: 'RFID tag added successfully', variant: 'success' });
            setShowAddModal(false);
            setNewRfidUuid('');
            setNewRfidLabel('');
            await fetchRfidTags();
        } catch (error) {
            setToast({ show: true, message: 'Failed to add RFID tag', variant: 'danger' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteRfid = async (rfidId: RFID['id']) => {
        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/rfids/${rfidId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setToast({ show: true, message: 'RFID tag deleted successfully', variant: 'success' });
            await fetchRfidTags();
        } catch (error) {
            console.error('Failed to delete RFID tag:', error);
            setToast({ show: true, message: 'Failed to delete RFID tag', variant: 'danger' });
        }
    };

    const handleReadRfid = async () => {
        setIsReading(true);
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/rfids/read`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { timeout: 30 },
            });
            setNewRfidUuid(response.data.uuid);
            setToast({ show: true, message: 'RFID tag read successfully', variant: 'success' });
        } catch (error) {
            console.error('Failed to read RFID tag:', error);
            setToast({ show: true, message: 'Failed to read RFID tag', variant: 'danger' });
        } finally {
            setIsReading(false);
        }
    };

    return (
        <div className="position-relative">
            <Toast 
                show={toast.show} 
                onClose={() => setToast({ ...toast, show: false })}
                delay={3000}
                autohide
                className="position-absolute top-0 end-0"
            >
                <Toast.Header>
                    <strong className="me-auto">{toast.variant === 'success' ? 'Success' : 'Error'}</strong>
                </Toast.Header>
                <Toast.Body>{toast.message}</Toast.Body>
            </Toast>

            <div className="d-flex justify-content-end align-items-center mb-4">
                <Button
                    variant="light"
                    className="border-0 d-flex align-items-center gap-2 shadow-sm hover-lift"
                    style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(8px)',
                        transition: 'all 0.2s ease-in-out'
                    }}
                    onClick={() => setShowAddModal(true)}
                >
                    <MdAdd size={20} />
                    <span>Add fob</span>
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" />
                </div>
            ) : (
                <Table responsive hover className="shadow-sm">
                    <thead className="bg-light">
                        <tr>
                            <th>Last Four Digits</th>
                            <th>Label</th>
                            <th>Created At</th>
                            <th className="text-end">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rfidTags.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="text-center py-4 text-muted">
                                    No RFID tags found
                                </td>
                            </tr>
                        ) : (
                            rfidTags.map((rfid) => (
                                <tr key={rfid.id}>
                                    <td>...{rfid.last_four_digits}</td>
                                    <td>{rfid.label}</td>
                                    <td>{new Date(rfid.created_at).toLocaleDateString(window.navigator.language)}</td>
                                    <td className="text-end">
                                        <Button 
                                            variant="outline-danger" 
                                            size="sm"
                                            onClick={() => {
                                                setSelectedRfid(rfid);
                                                setShowDeleteModal(true);
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </Table>
            )}

            <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Add new fob</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleAddRfid}>
                        <Form.Group className="mb-3">
                            <Form.Label>RFID UUID</Form.Label>
                            <div className="d-flex gap-2">
                                <Form.Control
                                    type="text"
                                    value={newRfidUuid}
                                    onChange={(e) => setNewRfidUuid(e.target.value)}
                                    placeholder="Enter or read RFID UUID"
                                />
                                <Button 
                                    variant="secondary" 
                                    onClick={handleReadRfid} 
                                    disabled={isReading}
                                >
                                    {isReading ? (
                                        <Spinner animation="border" size="sm" />
                                    ) : (
                                        'Read'
                                    )}
                                </Button>
                            </div>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Label</Form.Label>
                            <Form.Control
                                type="text"
                                value={newRfidLabel}
                                onChange={(e) => setNewRfidLabel(e.target.value)}
                                placeholder="Enter a descriptive label"
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={handleAddRfid}
                        disabled={!newRfidUuid}
                    >
                        Add RFID Tag
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete the RFID tag{' '}
                    <strong>{selectedRfid?.label}</strong>?
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={() => {
                            handleDeleteRfid(selectedRfid!.id);
                            setShowDeleteModal(false);
                        }}
                    >
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default RfidManagement;
