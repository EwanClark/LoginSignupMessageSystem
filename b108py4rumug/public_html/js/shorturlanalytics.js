addEventListener("DOMContentLoaded", function() {
    fetch("https://api.bubllz.com/analytics", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            shorturl: window.location.search.split("shorturl=")[1]
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
    })
});