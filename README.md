# Mock REST backend

## API usage

* Get all users associated with your token. By default it generates 50 faker users.

    ```
    GET /token/users
    ```

* Create a new user. All fields are required.

    ```
    POST /token/users
    {
        "name" : "John",
        "surname": "Doe",
        "avatar": "url",
        "birthday: "string date in JS format"
    }
    ```

* Edit specific user. All fields are required.

    ```
    PUT /token/users/user_id
    {
        "name" : "John",
        "surname": "Doe",
        "avatar": "url",
        "birthday: "string date in JS format"
    }
    ```

* Get specific user.

    ```
    GET /token/users/user_id
    ```

* Delete specific user.

    ```
    DELETE /token/users/user_id
    ```

