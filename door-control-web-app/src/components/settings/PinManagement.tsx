import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Alert, Modal, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { User, PIN } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { MdAdd } from 'react-icons/md';

interface PinManagementProps {
    user: User;
}

const commonPins = [
    '1234', '0000', '7777', '2000', '2222', '9999', '5555', '1122', '8888', '2001',
    '1111', '1212', '1004', '4444', '6969', '3333', '6666', '1313', '4321', '1010'
];

const REQUIRED_PIN_LENGTH = parseInt(process.env.NEXT_PUBLIC_REQUIRED_PIN_LENGTH || '4');

const unsafePinPatterns = [
    { regex: new RegExp(`^(${commonPins.join('|')})$`), reason: 'commonly used PIN' },
    { regex: /^(0123|1234|2345|3456|4567|5678|6789|7890)$/, reason: 'consecutive numbers' },
    { regex: /^(9876|8765|7654|6543|5432|4321|3210)$/, reason: 'reverse consecutive numbers' },
    { regex: /^(1379|1397|2468|2486)$/, reason: 'common keyboard pattern' },
    { regex: /^(19|20)\d{2}$/, reason: 'common year of birth' },
    { regex: /^(.)\1{3}$/, reason: 'repeated digits' },
];

const isUnsafePin = (pin: string): boolean => {
    return unsafePinPatterns.some(pattern => pattern.regex.test(pin));
};

const getUnsafePinReason = (pin: string): string => {
    const matchedPattern = unsafePinPatterns.find(pattern => pattern.regex.test(pin));
    return matchedPattern ? matchedPattern.reason : 'unknown reason';
};

const PinManagement: React.FC<PinManagementProps> = ({ user }) => {
    const { token } = useAuth();
    const [pins, setPins] = useState([]);
    const [newPin, setNewPin] = useState('');
    const [newPinLabel, setNewPinLabel] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [pinFeedback, setPinFeedback] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedPin, setSelectedPin] = useState<PIN | null>(null);

    const fetchPins = useCallback(async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/pins`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPins(response.data);
        } catch (error) {
            console.error('Failed to fetch PINs:', error);
            setError('Failed to fetch PINs. Please try again.');
        }
    }, [user.id, token]);

    useEffect(() => {
        fetchPins();
    }, [fetchPins]);

    const validatePin = (pin: string) => {
        if (pin.length !== REQUIRED_PIN_LENGTH) {
            return `PIN must be exactly ${REQUIRED_PIN_LENGTH} digits.`;
        }
        if (!/^\d+$/.test(pin)) {
            return 'PIN must contain only digits.';
        }
        if (isUnsafePin(pin)) {
            return `This PIN is not allowed: ${getUnsafePinReason(pin)}`;
        }
        return '';
    };

    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPinValue = e.target.value;
        setNewPin(newPinValue);
        setPinFeedback(validatePin(newPinValue));
    };

    const handleAddPin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user.role !== 'guest' && validatePin(newPin)) {
            setPinFeedback(validatePin(newPin));
            return;
        }

        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/pins`, {
                ...(user.role === 'guest' ? {} : { pin: newPin }),
                label: newPinLabel,
                user_id: user.id,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const successMessage = user.role === 'guest'
                ? `PIN generated successfully: ${response.data.pin}`
                : 'PIN added successfully';

            setNewPin('');
            setNewPinLabel('');
            setPinFeedback('');
            setSuccess(successMessage);
            setShowAddModal(false);
            fetchPins();
        } catch (error) {
            console.error('Failed to add PIN:', error);
            setError('Failed to add PIN. Please try again.');
        }
    };

    const handleDeletePin = async (pinId: PIN['id']) => {
        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/pins/${pinId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSuccess('PIN deleted successfully');
            setShowDeleteModal(false);
            fetchPins();
        } catch (error) {
            console.error('Failed to delete PIN:', error);
            if (axios.isAxiosError(error) && error.response) {
                setError(`Failed to delete PIN: ${error.response.data.detail}`);
            } else {
                setError('Failed to delete PIN. Please try again.');
            }
        }
    };

    return (
        <div className="position-relative">
            {/* Toast Notifications */}
            {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
            {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

            {/* Header Section */}
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
                    <span>Add PIN</span>
                </Button>
            </div>

            {/* PINs Table */}
            <Table responsive hover className="shadow-sm">
                <thead className="bg-light">
                    <tr>
                        <th>PIN</th>
                        <th>Label</th>
                        <th>Created At</th>
                        <th className="text-end">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {pins.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="text-center py-4 text-muted">
                                No PINs found
                            </td>
                        </tr>
                    ) : (
                        pins.map((pin: PIN) => (
                            <tr key={pin.id}>
                                <td>****</td>
                                <td>{pin.label}</td>
                                <td>{new Date(pin.created_at).toLocaleDateString(window.navigator.language)}</td>
                                <td className="text-end">
                                    <Button 
                                        variant="outline-danger" 
                                        size="sm"
                                        onClick={() => {
                                            setSelectedPin(pin);
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

            {/* Add PIN Modal */}
            <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Add New PIN</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleAddPin}>
                        <Form.Group className="mb-3">
                            <Form.Label>PIN</Form.Label>
                            <Form.Control
                                type="text"
                                value={newPin}
                                onChange={handlePinChange}
                                placeholder={user.role === 'guest' ? 'PIN will be generated automatically' : `Enter ${REQUIRED_PIN_LENGTH}-digit PIN`}
                                isInvalid={!!pinFeedback}
                                isValid={newPin.length > 0 && !pinFeedback}
                                disabled={user.role === 'guest'}
                            />
                            <Form.Control.Feedback type="invalid">
                                {pinFeedback}
                            </Form.Control.Feedback>
                            <Form.Control.Feedback type="valid">
                                PIN is valid
                            </Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Label</Form.Label>
                            <Form.Control
                                type="text"
                                value={newPinLabel}
                                onChange={(e) => setNewPinLabel(e.target.value)}
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
                        onClick={handleAddPin}
                        disabled={user.role !== 'guest' && (!newPin || !!pinFeedback)}
                    >
                        Add PIN
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete the PIN{' '}
                    <strong>{selectedPin?.label}</strong>?
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={() => handleDeletePin(selectedPin!.id)}
                    >
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default PinManagement;
