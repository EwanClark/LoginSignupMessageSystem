import requests

response = requests.post("https://api.bubllz.com/addshorturl", json={"redirecturl": "https://www.youtube.com/watch?v=GFjXfHo1oe8"}, headers={"token": "83fe2c76a1c4ba162542a978ed02275bd2671f103e39dfff238739b25e0c0e3df29722b22885ec7f66a1bd446f3d042d73badd18eaf951e4b2f1fd091157952f"})

print(response.text)
print(response.status_code)
print(response.headers)