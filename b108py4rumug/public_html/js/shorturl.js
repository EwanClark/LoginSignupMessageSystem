
document.getElementById('toggleDarkMode').addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('dark-mode', 'enabled');
    } else {
        localStorage.setItem('dark-mode', 'disabled');
    }
});

if (localStorage.getItem('dark-mode') === 'enabled') {
    document.body.classList.toggle('dark-mode');
}

document.getElementById('shortenButton').addEventListener('click', function() {
    document.getElementById('shortenButton').disabled = true;
    console.log('Shorten button clicked');
    var url = document.getElementById('url').value;
    var continuewithurl;
    if (!url) {
        alert('Please enter a URL');
        document.getElementById('shortenButton').disabled = false;
        return;
    }
    if (!url.startsWith('https://')) {
        console.log('URL does not start with https://');
        console.log('Adding https:// to the beginning of the URL');
        url = 'https://' + url;
        console.log(url);
    }
    if (!url.includes('.')) {
        alert('Please enter a valid URL');
        document.getElementById('shortenButton').disabled = false;
        return;
    }
    if (url.includes(' ')) {
        alert('Please enter a valid URL');
        document.getElementById('shortenButton').disabled = false;
        return;
    }
    if (url.includes('localhost')) {
        alert('Please enter a valid URL');
        document.getElementById('shortenButton').disabled = false;
        return;
    }
    console.log('Checking if URL is valid using fetch');
    fetch(`https://api.bubllz.com/validurl?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (response.status === 200) {
            console.log('URL is valid');
            continuewithurl = true;
        } else if (response.status === 250) {
            alert('Please enter a valid URL');
            continuewithurl = false;
        }
        else{
            alert('An error occurred');
            continuewithurl = false;
        }
    })
    .catch(error => {
        console.error('An error occurred:', error);
        alert('An error occurred');
        continuewithurl = false;
    })
    .finally(() => {
        if (continuewithurl){
            const parentDiv = document.querySelector('.url-list');
            const newDiv = document.createElement('div');
            newDiv.className = 'url-item';
            newDiv.textContent = `${url} >> https://bubllz.com/1234`;
            parentDiv.appendChild(newDiv);
            document.getElementById('url').value = '';
            document.getElementById('shortenButton').disabled = false;
            console.log("Done");
        }
        if (!continuewithurl){
            document.getElementById('shortenButton').disabled = false;
        }
    });
});