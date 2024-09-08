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
    fetch('https://api.bubllz.com/validurl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url
            })
    })
        .then(response => response.json())
        .then(response => {
            if (response.status == 200) {
                console.log('URL is valid');
            } else {
                alert('Please enter a valid URL');
                document.getElementById('shortenButton').disabled = false;
                return;
            }
        })
    
    const parentdiv = document.getElementById('urllist');
    parentdiv.appendChild(document.createElement('div').textContent(`${url} >> https://bubllz.com/1234}`));
    document.getElementById('url').value = '';
    console.log("Done");
    document.getElementById('shortenButton').disabled = false;
});