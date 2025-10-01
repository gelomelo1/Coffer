from fastapi import FastAPI

app = FastAPI()

print(app)

@app.get("/hello")
async def say_hello():
    return {"message" : "Hello from Python FastAPI"}
