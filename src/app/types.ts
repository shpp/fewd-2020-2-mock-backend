export interface User {
    name: string;
    surname: string;
    avatar: string;
    birthday: string;
    deleted?: boolean;
}

export interface State {
    users: {
        [id: string]: User
    };
}