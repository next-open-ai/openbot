import sys
import os
sys.path.append('/Users/ctrip/.pi/agent/skills/travel-planner/scripts')
from travel_db import add_trip

# 创建三亚旅行计划
trip = {
    "destination": {
        "city": "三亚",
        "country": "中国",
        "region": "海南"
    },
    "departure_date": "2026-02-04",  # 明天
    "return_date": "2026-02-05",
    "duration_days": 2,
    "budget": {
        "total": 3000,
        "currency": "CNY"
    },
    "purpose": "vacation",
    "travelers": 2,
    "climate": "热带海洋性气候，温暖湿润",
    "activities": ["海滩", "水上活动", "海鲜美食", "观光"],
    "accommodation": {
        "type": "度假酒店",
        "location": "亚龙湾"
    },
    "notes": "上海到三亚的2天周末游"
}

trip_id = add_trip(trip, status="current")
print(f"旅行计划已创建，ID: {trip_id}")