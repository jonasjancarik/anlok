import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Alert } from 'react-bootstrap';
import axios from 'axios';
import { ApiKey } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { MdAdd } from 'react-icons/md';

const ApiKeyManagement: React.FC = () => {
    const { token, user } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
    const [newKeyDescription, setNewKeyDescription] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

    const fetchApiKeys = useCallback(async () => {
        try {
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/api-keys`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setApiKeys(response.data);
        } catch (error) {
            console.error('Failed to fetch API keys:', error);
            setError('Failed to fetch API keys. Please try again.');
        }
    }, [token]);

    useEffect(() => {
        fetchApiKeys();
    }, [fetchApiKeys]);

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/api-keys`,
                {
                    description: newKeyDescription,
                    user_id: user?.id
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setNewlyCreatedKey(response.data.api_key);
            setSuccess('API key created successfully');
            setNewKeyDescription('');
            fetchApiKeys();
        } catch (error) {
            console.error('Failed to create API key:', error);
            setError('Failed to create API key. Please try again.');
        }
    };

    const handleDeleteKey = async (keySuffix: string) => {
        try {
            await axios.delete(
                `${process.env.NEXT_PUBLIC_API_URL}/api-keys/${keySuffix}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('API key deleted successfully');
            setShowDeleteModal(false);
            fetchApiKeys();
        } catch (error) {
            console.error('Failed to delete API key:', error);
            setError('Failed to delete API key. Please try again.');
        }
    };

    return (
        <div>
            {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
            {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

            <div className="d-flex justify-content-end mb-3">
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
                    <span>Create API Key</span>
                </Button>
            </div>

            <Table responsive hover className="shadow-sm">
                <thead className="bg-light">
                    <tr>
                        <th>Key Suffix</th>
                        <th>Description</th>
                        <th>Created At</th>
                        <th>Status</th>
                        <th className="text-end">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {apiKeys.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="text-center py-4 text-muted">
                                No API keys found
                            </td>
                        </tr>
                    ) : (
                        apiKeys.map((key) => (
                            <tr key={key.key_suffix}>
                                <td>...{key.key_suffix}</td>
                                <td>{key.description}</td>
                                <td>{new Date(key.created_at).toLocaleDateString(window.navigator.language)}</td>
                                <td>
                                    <span className={`badge bg-${key.is_active ? 'success' : 'danger'}`}>
                                        {key.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="text-end">
                                    <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedKey(key);
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

            {/* Create API Key Modal */}
            <Modal show={showAddModal} onHide={() => {
                setShowAddModal(false);
                setNewlyCreatedKey(null);
            }}>
                <Modal.Header closeButton>
                    <Modal.Title>Create API Key</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {newlyCreatedKey ? (
                        <div>
                            <Alert variant="warning">
                                <strong>Important:</strong> Copy your API key now. You won&apos;t be able to see it again!
                            </Alert>
                            <Form.Group>
                                <Form.Control
                                    type="text"
                                    value={newlyCreatedKey}
                                    readOnly
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                            </Form.Group>
                        </div>
                    ) : (
                        <Form onSubmit={handleCreateKey}>
                            <Form.Group>
                                <Form.Label>Description</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={newKeyDescription}
                                    onChange={(e) => setNewKeyDescription(e.target.value)}
                                    placeholder="Enter a description for this API key"
                                    required
                                />
                            </Form.Group>
                        </Form>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => {
                        setShowAddModal(false);
                        setNewlyCreatedKey(null);
                    }}>
                        Close
                    </Button>
                    {!newlyCreatedKey && (
                        <Button variant="primary" onClick={handleCreateKey}>
                            Create Key
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete this API key?
                    <br />
                    <strong>Description:</strong> {selectedKey?.description}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => selectedKey && handleDeleteKey(selectedKey.key_suffix)}
                    >
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ApiKeyManagement;