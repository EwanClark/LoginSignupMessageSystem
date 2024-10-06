addEventListener("DOMContentLoaded", function() {
    fetch("https://api.bubllz.com/shorturlanalytics", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "shorturl": window.location.search.split("shorturl=")[1]
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
    })
});