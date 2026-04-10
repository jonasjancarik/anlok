import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Alert, Card } from 'react-bootstrap';
import axios from 'axios';
import { User, Apartment } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { FaEdit, FaBuilding, FaTrash } from 'react-icons/fa';

interface ApartmentManagementProps { }

const ApartmentManagement: React.FC<ApartmentManagementProps> = () => {
    const { token, user } = useAuth();
    const [apartments, setApartments] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
    const [newApartment, setNewApartment] = useState({ number: '', description: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchApartments = useCallback(async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/apartments`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setApartments(response.data);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.data?.error?.detail) {
                setError(error.response.data.error.detail);
            } else {
                setError('Unable to load apartments. Please check your connection and try again.');
            }
            console.error('Fetch apartments error:', error);
        }
    }, [token]);

    useEffect(() => {
        fetchApartments();
    }, [fetchApartments]);

    const handleAddApartment = () => {
        setSelectedApartment(null);
        setNewApartment({ number: '', description: '' });
        setShowModal(true);
    };

    const handleEditApartment = (apartment: Apartment) => {
        setSelectedApartment(apartment);
        setNewApartment({ number: apartment.number, description: apartment.description });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (selectedApartment) {
                await axios.put(
                    `${process.env.NEXT_PUBLIC_API_URL}/apartments/${selectedApartment.id}`, 
                    newApartment, 
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setSuccess('Apartment updated successfully');
            } else {
                await axios.post(
                    `${process.env.NEXT_PUBLIC_API_URL}/apartments`, 
                    newApartment, 
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setSuccess('Apartment added successfully');
            }
            setShowModal(false);
            fetchApartments();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.data?.error?.detail) {
                    setError(error.response.data.error.detail);
                } else if (error.response?.status === 401) {
                    setError('Your session has expired. Please log in again.');
                } else if (error.response?.status === 403) {
                    setError('You do not have permission to perform this action.');
                } else if (!error.response) {
                    setError('Unable to connect to the server. Please check your connection.');
                } else {
                    setError(`An error occurred: ${error.response.status} ${error.response.statusText}`);
                }
            } else {
                setError('An unexpected error occurred. Please try again.');
            }
            console.error('Save apartment error:', error);
        }
    };

    const handleDeleteApartment = async (apartmentId: Apartment['id']) => {
        try {
            await axios.delete(
                `${process.env.NEXT_PUBLIC_API_URL}/apartments/${apartmentId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Apartment deleted successfully');
            setShowDeleteModal(false);
            setShowModal(false);
            fetchApartments();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.data?.error?.detail) {
                    setError(error.response.data.error.detail);
                } else if (error.response?.status === 401) {
                    setError('Your session has expired. Please log in again.');
                } else if (error.response?.status === 403) {
                    setError('You do not have permission to delete this apartment.');
                } else if (!error.response) {
                    setError('Unable to connect to the server. Please check your connection.');
                } else {
                    setError(`Failed to delete apartment: ${error.response.status} ${error.response.statusText}`);
                }
            } else {
                setError('An unexpected error occurred while deleting the apartment.');
            }
            console.error('Delete apartment error:', error);
        }
    };

    return (
        <div>
            {error && (
                <Alert 
                    variant="danger" 
                    dismissible 
                    onClose={() => setError('')}
                    className="d-flex align-items-center"
                >
                    <div className="me-2">
                        <strong>Error: </strong>
                        {error}
                    </div>
                </Alert>
            )}
            {success && (
                <Alert 
                    variant="success" 
                    dismissible 
                    onClose={() => setSuccess('')}
                    className="d-flex align-items-center"
                >
                    <div className="me-2">{success}</div>
                </Alert>
            )}
            
            <Button variant='primary' onClick={handleAddApartment} className='mb-3'>
                <FaBuilding className="me-2" />Add Apartment
            </Button>

            <div className="d-flex flex-wrap">
                {apartments.map((apartment: Apartment) => (
                    <Card key={apartment.id} className="me-2 mb-2" style={{ width: '18rem' }}>
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                                <Card.Title className="mb-0">Apartment {apartment.number}</Card.Title>
                                <Button 
                                    variant="link" 
                                    size="sm" 
                                    onClick={() => handleEditApartment(apartment)} 
                                    className="p-0 text-muted"
                                >
                                    <FaEdit style={{ position: 'relative', top: '-1px' }}/>
                                </Button>
                            </div>
                            <Card.Text>{apartment.description}</Card.Text>
                        </Card.Body>
                    </Card>
                ))}
            </div>

            {/* Edit/Add Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>{selectedApartment ? 'Edit Apartment' : 'Add New Apartment'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Apartment Number</Form.Label>
                            <Form.Control
                                type="text"
                                value={newApartment.number}
                                onChange={(e) => setNewApartment({ ...newApartment, number: e.target.value })}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={newApartment.description}
                                onChange={(e) => setNewApartment({ ...newApartment, description: e.target.value })}
                            />
                        </Form.Group>
                        {selectedApartment && (
                            <Button 
                                variant="outline-danger" 
                                onClick={() => setShowDeleteModal(true)}
                                className="me-2"
                            >
                                <FaTrash className="me-1" />Delete Apartment
                            </Button>
                        )}
                        <Button variant="primary" type="submit">
                            {selectedApartment ? 'Update Apartment' : 'Add Apartment'}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete Apartment{' '}
                    <strong>{selectedApartment?.number}</strong>?
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel  
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={() => handleDeleteApartment(selectedApartment!.id)}
                    >
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ApartmentManagement;
