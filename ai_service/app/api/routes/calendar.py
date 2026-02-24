"""
日历API路由
处理日历同步和事件管理
"""

from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.api.deps import get_db, get_trace_id, get_request_id
from app.services.calendar_service import (
    get_calendar_service,
    CalendarProvider,
    CalendarEvent,
)

logger = get_logger(__name__)
router = APIRouter()


@router.get("/events")
async def get_calendar_events(
    user_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    获取日历事件
    
    获取指定时间范围内的日历事件
    """
    if not start_date:
        start_date = datetime.now()
    if not end_date:
        end_date = start_date + timedelta(days=7)
    
    calendar_service = get_calendar_service()
    
    try:
        events = await calendar_service.get_events(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )
        
        logger.info(
            "calendar.events.retrieved",
            user_id=user_id,
            count=len(events),
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "events": [
                {
                    "id": event.id,
                    "title": event.title,
                    "description": event.description,
                    "start_time": event.start_time.isoformat(),
                    "end_time": event.end_time.isoformat(),
                    "location": event.location,
                    "source": event.source,
                    "task_id": event.task_id,
                }
                for event in events
            ],
        }
    except Exception as e:
        logger.error("calendar.events.failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"获取日历事件失败: {str(e)}")


@router.post("/events")
async def create_calendar_event(
    user_id: str,
    title: str,
    start_time: datetime,
    end_time: datetime,
    description: Optional[str] = None,
    location: Optional[str] = None,
    task_id: Optional[str] = None,
    provider: CalendarProvider = CalendarProvider.LOCAL,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    创建日历事件
    
    创建一个新的日历事件
    """
    calendar_service = get_calendar_service()
    
    event = CalendarEvent(
        id=str(uuid4()),
        title=title,
        description=description,
        start_time=start_time,
        end_time=end_time,
        location=location,
        task_id=task_id,
        source="flowboard",
    )
    
    try:
        created_event = await calendar_service.create_event(
            user_id=user_id,
            event=event,
            provider=provider,
        )
        
        logger.info(
            "calendar.event.created",
            user_id=user_id,
            event_id=created_event.id,
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "event": {
                "id": created_event.id,
                "title": created_event.title,
                "start_time": created_event.start_time.isoformat(),
                "end_time": created_event.end_time.isoformat(),
            },
        }
    except Exception as e:
        logger.error("calendar.event.create_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"创建日历事件失败: {str(e)}")


@router.get("/sync-status")
async def get_sync_status(
    user_id: str,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    获取日历同步状态
    
    检查日历同步的配置和状态
    """
    calendar_service = get_calendar_service()
    
    status = await calendar_service.get_sync_status(user_id)
    
    return {
        "trace_id": trace_id,
        "request_id": request_id,
        "status": status,
    }


@router.post("/sync")
async def sync_calendar(
    user_id: str,
    provider: CalendarProvider = CalendarProvider.LOCAL,
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    同步日历
    
    手动触发日历同步
    """
    calendar_service = get_calendar_service()
    
    try:
        result = await calendar_service.sync_calendar(
            user_id=user_id,
            provider=provider,
        )
        
        logger.info(
            "calendar.sync.completed",
            user_id=user_id,
            provider=provider.value,
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "synced": result,
        }
    except Exception as e:
        logger.error("calendar.sync.failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"日历同步失败: {str(e)}")


@router.get("/availability")
async def check_availability(
    user_id: str,
    date: datetime,
    duration_minutes: int = Query(60, ge=15, le=480),
    trace_id: str = Depends(get_trace_id),
    request_id: str = Depends(get_request_id),
):
    """
    检查时间可用性
    
    检查指定日期是否有可用的时间段
    
    - duration_minutes: 需要的空闲时长（分钟）
    """
    calendar_service = get_calendar_service()
    
    # 获取当天的所有事件
    start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    try:
        events = await calendar_service.get_events(
            user_id=user_id,
            start_date=start_of_day,
            end_date=end_of_day,
        )
        
        # 计算可用时间段
        available_slots = calculate_available_slots(
            events, start_of_day, end_of_day, duration_minutes
        )
        
        return {
            "trace_id": trace_id,
            "request_id": request_id,
            "date": date.date().isoformat(),
            "available_slots": available_slots,
            "total_available_minutes": sum(
                (slot["end"] - slot["start"]).total_seconds() // 60
                for slot in available_slots
            ),
        }
    except Exception as e:
        logger.error("calendar.availability.failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"检查可用性失败: {str(e)}")


def calculate_available_slots(
    events: List[CalendarEvent],
    start_of_day: datetime,
    end_of_day: datetime,
    duration_minutes: int,
) -> List[dict]:
    """计算可用时间段"""
    # 工作时间：9:00 - 18:00
    work_start = start_of_day.replace(hour=9)
    work_end = start_of_day.replace(hour=18)
    
    # 按时间排序的事件
    sorted_events = sorted(events, key=lambda e: e.start_time)
    
    # 过滤工作时间内的事件
    work_events = [
        e for e in sorted_events
        if e.start_time < work_end and e.end_time > work_start
    ]
    
    # 计算空闲时段
    available_slots = []
    current_time = work_start
    
    for event in work_events:
        if current_time < event.start_time:
            slot_duration = (event.start_time - current_time).total_seconds() // 60
            if slot_duration >= duration_minutes:
                available_slots.append({
                    "start": current_time.isoformat(),
                    "end": event.start_time.isoformat(),
                    "duration_minutes": int(slot_duration),
                })
        current_time = max(current_time, event.end_time)
    
    # 检查最后一个事件之后的时间
    if current_time < work_end:
        slot_duration = (work_end - current_time).total_seconds() // 60
        if slot_duration >= duration_minutes:
            available_slots.append({
                "start": current_time.isoformat(),
                "end": work_end.isoformat(),
                "duration_minutes": int(slot_duration),
            })
    
    return available_slots
