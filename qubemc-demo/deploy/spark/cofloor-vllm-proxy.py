import asyncio

async def handle(reader, writer):
    try:
        upstream_reader, upstream_writer = await asyncio.open_connection("100.89.121.112", 8000)
        async def copy(source, destination):
            try:
                while chunk := await source.read(65536):
                    destination.write(chunk)
                    await destination.drain()
            finally:
                destination.close()
        await asyncio.gather(copy(reader, upstream_writer), copy(upstream_reader, writer))
    except Exception:
        writer.close()

async def main():
    server = await asyncio.start_server(handle, "127.0.0.1", 18000)
    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    asyncio.run(main())
