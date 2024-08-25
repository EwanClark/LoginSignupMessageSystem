function SignupButtonClicked() {
    var FirstNameInputElement = document.getElementById("Fname");
    var FirstNameInput = FirstNameInputElement.value;

    var LastNameInputElement = document.getElementById("Lname");
    var LastNameInput = LastNameInputElement.value;

    var UsernameInputElement = document.getElementById("Username");
    var UsernameInput = UsernameInputElement.value;

    var passwordInputElement = document.getElementById("Password");
    var passwordInput = passwordInputElement.value;
    
    var passwordAgainInputElement = document.getElementById("PasswordAgain");
    var passwordAgainInput = passwordAgainInputElement.value;

    if (passwordInput != passwordAgainInput) {
        alert("Passwords do not match");
        return;
    }
    if (FirstNameInput == "" || LastNameInput == "" || UsernameInput == "" || passwordInput == "" || passwordAgainInput == "") {
        alert("Please fill out all fields");
        return;
    }
    if (passwordInput.length < 8) {
        alert("Password must be at least 8 characters long");
        return;
    }
    if (passwordInput.search(/[a-z]/) < 0) {
        alert("Password must contain at least one lowercase letter");
        return;
    }
    if (passwordInput.search(/[A-Z]/) < 0) {
        alert("Password must contain at least one uppercase letter");
        return;
    }
    if (passwordInput.search(/[0-9]/) < 0) {
        alert("Password must contain at least one number");
        return;
    }
    if (passwordInput.search(/[!@#$%^&*]/) < 0) {
        alert("Password must contain at least one special character");
        return;
    }
    if (passwordInput.search(/\s/) >= 0) {
        alert("Password must not contain any whitespace");
        return;
    }
    else {
        fetch("https://api.bubllz.com/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "FirstName": FirstNameInput,
                "LastName": LastNameInput,
                "Username": UsernameInput,
                "Password": passwordInput
            })
        })
        .then (response => {
            if (response.status === 400) {
                alert("Username already exists");
                throw new Error('Username already exists.');
            }
            else if (response.status === 500) {
                alert("Database error");
                throw new Error('Database error.');
            }
    return response.json();
    })  
        .then(responseData => {
            console.log('Success:', responseData);
            alert(`User signed up successfully! as ${UsernameInput}`);
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation: ', error);
        });
    }
}