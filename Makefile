.PHONY: dev stop status logs

PIDS_DIR := .pids

$(PIDS_DIR):
	mkdir -p $(PIDS_DIR)

## dev: backend/frontend/agent 3 서비스 백그라운드 동시 기동
dev: $(PIDS_DIR)
	@echo "==> 서비스 시작 중..."
	@# Backend
	@if [ -f $(PIDS_DIR)/backend.pid ] && kill -0 $$(cat $(PIDS_DIR)/backend.pid) 2>/dev/null; then \
		echo "  backend 이미 실행 중 (PID=$$(cat $(PIDS_DIR)/backend.pid))"; \
	else \
		set -a; [ -f .env ] && . ./.env; set +a; \
		nohup uv run --project backend uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000 \
			> $(PIDS_DIR)/backend.log 2>&1 & \
		echo $$! > $(PIDS_DIR)/backend.pid; \
		echo "  backend 시작 (PID=$$!)"; \
	fi
	@# Frontend
	@if [ -f $(PIDS_DIR)/frontend.pid ] && kill -0 $$(cat $(PIDS_DIR)/frontend.pid) 2>/dev/null; then \
		echo "  frontend 이미 실행 중 (PID=$$(cat $(PIDS_DIR)/frontend.pid))"; \
	else \
		set -a; [ -f .env ] && . ./.env; set +a; \
		cd frontend && nohup npm run dev -- --hostname 127.0.0.1 --port 3000 \
			> ../$(PIDS_DIR)/frontend.log 2>&1 & \
		echo $$! > ../$(PIDS_DIR)/frontend.pid; \
		echo "  frontend 시작 (PID=$$!)"; \
	fi
	@# Agent
	@if [ -f $(PIDS_DIR)/agent.pid ] && kill -0 $$(cat $(PIDS_DIR)/agent.pid) 2>/dev/null; then \
		echo "  agent 이미 실행 중 (PID=$$(cat $(PIDS_DIR)/agent.pid))"; \
	else \
		set -a; [ -f .env ] && . ./.env; set +a; \
		cd agent && npm run build 2>&1 | tail -3; \
		set -a; [ -f ../.env ] && . ../.env; set +a; \
		cd agent && nohup node dist/server.js \
			> ../$(PIDS_DIR)/agent.log 2>&1 & \
		echo $$! > $(PIDS_DIR)/agent.pid; \
		echo "  agent 시작 (PID=$$!)"; \
	fi
	@echo ""
	@echo "==> 서비스 ready 대기 중 (최대 30초)..."
	@$(MAKE) _wait_ready
	@echo ""
	@$(MAKE) status

_wait_ready:
	@i=0; \
	while [ $$i -lt 30 ]; do \
		b=0; f=0; a=0; \
		curl -sf http://127.0.0.1:8000/docs > /dev/null 2>&1 && b=1; \
		code=$$(curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ 2>/dev/null); \
		echo "$$code" | grep -qE "^(200|307)$$" && f=1; \
		curl -sf http://127.0.0.1:8787/health > /dev/null 2>&1 && a=1; \
		if [ $$b -eq 1 ] && [ $$f -eq 1 ] && [ $$a -eq 1 ]; then \
			echo "  모든 서비스 ready ($$i초 소요)"; \
			exit 0; \
		fi; \
		sleep 1; \
		i=$$((i+1)); \
	done; \
	echo "  경고: 30초 안에 일부 서비스가 ready 되지 않았습니다. make status 로 확인하세요."

## stop: PID 파일 기반 서비스 종료
stop:
	@for svc in backend frontend agent; do \
		pid_file=$(PIDS_DIR)/$$svc.pid; \
		if [ -f $$pid_file ]; then \
			pid=$$(cat $$pid_file); \
			if kill -0 $$pid 2>/dev/null; then \
				kill $$pid && echo "  $$svc 종료 (PID=$$pid)"; \
			else \
				echo "  $$svc PID=$$pid 이미 종료됨"; \
			fi; \
			rm -f $$pid_file; \
		else \
			echo "  $$svc PID 파일 없음 (이미 중지됨)"; \
		fi; \
	done

## status: 3 서비스 health 체크
status:
	@echo "==> 서비스 상태"
	@# Backend
	@if curl -sf http://127.0.0.1:8000/docs > /dev/null 2>&1; then \
		echo "  [OK] backend  http://127.0.0.1:8000"; \
	else \
		echo "  [--] backend  http://127.0.0.1:8000 (응답 없음)"; \
	fi
	@# Frontend
	@code=$$(curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ 2>/dev/null); \
	if echo "$$code" | grep -qE "^(200|307)$$"; then \
		echo "  [OK] frontend http://127.0.0.1:3000 (HTTP $$code)"; \
	else \
		echo "  [--] frontend http://127.0.0.1:3000 (응답 없음 또는 HTTP $$code)"; \
	fi
	@# Agent
	@if curl -sf http://127.0.0.1:8787/health > /dev/null 2>&1; then \
		echo "  [OK] agent    http://127.0.0.1:8787"; \
	else \
		echo "  [--] agent    http://127.0.0.1:8787 (응답 없음)"; \
	fi

## logs: 각 서비스 로그 tail
logs:
	@echo "==> backend 로그 ($(PIDS_DIR)/backend.log)"
	@[ -f $(PIDS_DIR)/backend.log ] && tail -20 $(PIDS_DIR)/backend.log || echo "  로그 파일 없음"
	@echo ""
	@echo "==> frontend 로그 ($(PIDS_DIR)/frontend.log)"
	@[ -f $(PIDS_DIR)/frontend.log ] && tail -20 $(PIDS_DIR)/frontend.log || echo "  로그 파일 없음"
	@echo ""
	@echo "==> agent 로그 ($(PIDS_DIR)/agent.log)"
	@[ -f $(PIDS_DIR)/agent.log ] && tail -20 $(PIDS_DIR)/agent.log || echo "  로그 파일 없음"
