function modalShow() {
    let username = "";

    $('#usernameModal').modal('show');

    $('#confirmUsername').click(function () {
        const inputName = $('#modalUsername').val().trim();

        if (inputName) {
            username = inputName;
            $('#usernameModal').modal('hide');
            startChat(username);

            connection.start()
                .then(function () {
                    connection.invoke("RegisterUser", username);
                })
                .catch(function (err) {
                    console.error(err.toString());
                });

        } else {
            alert("Por favor, insira um nome");
        }

    });
}

$(document).ready(function () {
    modalShow();
});