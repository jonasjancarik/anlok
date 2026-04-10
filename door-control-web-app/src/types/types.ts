export interface User {
    id: number;
    name: string;
    email?: string;
    role: 'admin' | 'apartment_admin' | 'guest';
    creator_id: number;
    apartment_id: string;
    is_active: boolean;
    apartment: Apartment;
    recurring_schedules?: RecurringSchedule[];
    one_time_access?: OneTimeAccess[];
}

export interface PIN {
    id: number;
    label: string;
    created_at: string;
}

export interface RFID {
    id: number;
    user_id: number;
    hashed_uuid: string;
    last_four_digits: string;
    label: string;
    creator_email: string;
    created_at: string;
}

export interface RecurringSchedule {
    id: number;
    user_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
}

export interface OneTimeAccess {
    id: number;
    user_id: number;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
}

export interface Apartment {
    id: number;
    number: string;
    description: string;
    users: User[];
}

export interface ApiKey {
    key_suffix: string;
    description: string;
    created_at: string;
    is_active: boolean;
    user_id: number;
    api_key?: string; // Only present when creating a new key
}
