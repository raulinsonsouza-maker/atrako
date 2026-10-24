#!/bin/bash
TID=$(docker ps -q -f name=atrako_web.1)
docker logs "$TID" 2>&1 | grep -iE 'mp\]|createMercado|orders|Falha|payment|charge|H1FR8N' | tail -50