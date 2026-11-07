"""End-to-end ephemeral tests for client-first preferred scheduling flows."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

MANILA_TZ = ZoneInfo("Asia/Manila")


def _first_active_service(api_url: str, name: str = "Individual Counseling & Psychotherapy") -> dict:
    res = httpx.get(f"{api_url}/services/active", timeout=10)
    assert res.status_code == 200, res.text
    for svc in res.json():
        if svc["name"] == name:
            return svc
    return res.json()[0]


def test_booking_preferred_slots_validation(
    api_url: str,
    authenticated_user_factory,
    create_client_persona,
    future_slot_inputs,
):
    client = authenticated_user_factory("client")
    persona = create_client_persona(client["auth_headers"])
    service = _first_active_service(api_url)

    # 1. Fewer than 3 preferred schedules -> 422
    too_few = future_slot_inputs(days_ahead=4, hours=("09:00:00", "11:00:00"))
    res_few = httpx.post(
        f"{api_url}/appointments",
        headers=client["auth_headers"],
        json={
            "persona_id": persona["persona_id"],
            "service_id": service["service_id"],
            "presenting_concern": "Stress management check-in",
            "preferred_slots": too_few,
        },
        timeout=15,
    )
    assert res_few.status_code == 422

    # 2. Duplicate (session_date, start_time) -> 422
    dup_slots = future_slot_inputs(
        days_ahead=4, hours=("10:00:00", "10:00:00", "14:00:00")
    )
    res_dup = httpx.post(
        f"{api_url}/appointments",
        headers=client["auth_headers"],
        json={
            "persona_id": persona["persona_id"],
            "service_id": service["service_id"],
            "presenting_concern": "Duplicate slot test",
            "preferred_slots": dup_slots,
        },
        timeout=15,
    )
    assert res_dup.status_code == 422

    # 3. Past schedule -> 422
    past_date = (datetime.now(MANILA_TZ).date() - timedelta(days=2)).isoformat()
    past_slots = [
        {"session_date": past_date, "start_time": "09:00:00"},
        {"session_date": past_date, "start_time": "11:00:00"},
        {"session_date": past_date, "start_time": "14:00:00"},
    ]
    res_past = httpx.post(
        f"{api_url}/appointments",
        headers=client["auth_headers"],
        json={
            "persona_id": persona["persona_id"],
            "service_id": service["service_id"],
            "presenting_concern": "Past slot test",
            "preferred_slots": past_slots,
        },
        timeout=15,
    )
    assert res_past.status_code == 422


def test_direct_pickup_payment_conflict_and_completion_flow(
    api_url: str,
    authenticated_user_factory,
    create_client_persona,
    future_slot_inputs,
):
    client = authenticated_user_factory("client")
    psych_1 = authenticated_user_factory("psychologist")
    psych_2 = authenticated_user_factory("psychologist")

    persona = create_client_persona(client["auth_headers"])
    service = _first_active_service(api_url)  # 60-minute session
    slots = future_slot_inputs(days_ahead=6, hours=("09:00:00", "13:00:00", "15:00:00"))

    # 1. Client submits booking with 3 preferred schedules
    create_res = httpx.post(
        f"{api_url}/appointments",
        headers=client["auth_headers"],
        json={
            "persona_id": persona["persona_id"],
            "service_id": service["service_id"],
            "presenting_concern": "Work burnout and sleep difficulty",
            "preferred_slots": slots,
        },
        timeout=15,
    )
    assert create_res.status_code == 200, create_res.text
    appt = create_res.json()
    appt_id = appt["appointment_id"]
    assert appt["status"] == "pending"
    assert appt["scheduling_round"] == 1
    assert len(appt["proposed_slots"]) == 3
    assert all(s["proposed_by"] == "client" and s["end_time"] is not None for s in appt["proposed_slots"])

    chosen_slot_id = appt["proposed_slots"][0]["slot_id"]

    # 2. Pending queue includes the appointment
    pending_res = httpx.get(
        f"{api_url}/appointments/pending",
        headers=psych_1["auth_headers"],
        timeout=15,
    )
    assert pending_res.status_code == 200, pending_res.text
    assert any(item["appointment_id"] == appt_id for item in pending_res.json())

    # 3. Guardrail: psychologist without social_media_links cannot pick up (422)
    blocked_pickup = httpx.post(
        f"{api_url}/appointments/{appt_id}/pickup",
        headers=psych_1["auth_headers"],
        json={"price": 1500.0, "slot_id": chosen_slot_id},
        timeout=15,
    )
    assert blocked_pickup.status_code == 422

    # 4. Configure social_media_links on both psychologists
    for idx, psych in enumerate((psych_1, psych_2), start=1):
        prof_res = httpx.patch(
            f"{api_url}/psychologist-profile/me",
            headers=psych["auth_headers"],
            json={
                "specialization": "Clinical Psychology",
                "social_media_links": [
                    {
                        "platform": "Messenger",
                        "url": f"https://m.me/ephemeral.psych.{idx}",
                    }
                ],
            },
            timeout=15,
        )
        assert prof_res.status_code == 200, prof_res.text

    # 5. Psychologist 1 atomically picks up and accepts slot #1 -> awaiting_payment
    pickup_res = httpx.post(
        f"{api_url}/appointments/{appt_id}/pickup",
        headers=psych_1["auth_headers"],
        json={"price": 1500.0, "slot_id": chosen_slot_id},
        timeout=15,
    )
    assert pickup_res.status_code == 200, pickup_res.text
    picked = pickup_res.json()
    assert picked["status"] == "awaiting_payment"
    assert picked["selected_slot_id"] == chosen_slot_id
    assert picked["payment_deadline"] is not None

    # Contact privacy: psychologist social links stay hidden from client before payment
    client_pre_pay = httpx.get(
        f"{api_url}/appointments/{appt_id}",
        headers=client["auth_headers"],
        timeout=15,
    )
    assert client_pre_pay.status_code == 200
    assert client_pre_pay.json()["psychologist_social_links"] == []

    # 6. Atomic pickup guard: Psychologist 2 attempting pickup receives 409 Conflict
    second_pickup = httpx.post(
        f"{api_url}/appointments/{appt_id}/pickup",
        headers=psych_2["auth_headers"],
        json={"price": 1500.0, "slot_id": chosen_slot_id},
        timeout=15,
    )
    assert second_pickup.status_code == 409

    # 7. Client pays -> FakePaymentProvider auto-confirms appointment & unlocks social links
    pay_res = httpx.post(
        f"{api_url}/appointments/{appt_id}/payment",
        headers=client["auth_headers"],
        json={"payment_method": "gcash"},
        timeout=15,
    )
    assert pay_res.status_code == 200, pay_res.text
    assert pay_res.json()["status"] == "paid"

    confirmed_res = httpx.get(
        f"{api_url}/appointments/{appt_id}",
        headers=client["auth_headers"],
        timeout=15,
    )
    assert confirmed_res.status_code == 200
    confirmed = confirmed_res.json()
    assert confirmed["status"] == "confirmed"
    assert len(confirmed["psychologist_social_links"]) == 1
    assert confirmed["psychologist_social_links"][0]["platform"] == "Messenger"

    # 8. Overlapping slot conflict annotation & 409 guard on a second booking
    overlap_create = httpx.post(
        f"{api_url}/appointments",
        headers=client["auth_headers"],
        json={
            "persona_id": persona["persona_id"],
            "service_id": service["service_id"],
            "presenting_concern": "Follow-up overlap check",
            "preferred_slots": slots,
        },
        timeout=15,
    )
    assert overlap_create.status_code == 200, overlap_create.text
    overlap_appt = overlap_create.json()
    overlap_appt_id = overlap_appt["appointment_id"]
    overlapping_slot_id = overlap_appt["proposed_slots"][0]["slot_id"]

    pending_after = httpx.get(
        f"{api_url}/appointments/pending",
        headers=psych_1["auth_headers"],
        timeout=15,
    )
    assert pending_after.status_code == 200
    annotated = next(
        item for item in pending_after.json() if item["appointment_id"] == overlap_appt_id
    )
    assert overlapping_slot_id in annotated["conflicting_slot_ids"]

    conflict_pickup = httpx.post(
        f"{api_url}/appointments/{overlap_appt_id}/pickup",
        headers=psych_1["auth_headers"],
        json={"price": 1500.0, "slot_id": overlapping_slot_id},
        timeout=15,
    )
    assert conflict_pickup.status_code == 409

    # Clean up the second pending booking via cancel
    cancel_overlap = httpx.delete(
        f"{api_url}/appointments/{overlap_appt_id}",
        headers=client["auth_headers"],
        timeout=15,
    )
    assert cancel_overlap.status_code == 200

    # 9. Complete session & verify ?status=completed filtering for both roles
    complete_res = httpx.post(
        f"{api_url}/appointments/{appt_id}/complete",
        headers=psych_1["auth_headers"],
        timeout=15,
    )
    assert complete_res.status_code == 200, complete_res.text
    assert complete_res.json()["status"] == "completed"

    client_completed = httpx.get(
        f"{api_url}/appointments",
        headers=client["auth_headers"],
        params={"status": "completed"},
        timeout=15,
    )
    assert client_completed.status_code == 200
    assert [a["appointment_id"] for a in client_completed.json()] == [appt_id]

    psych_completed = httpx.get(
        f"{api_url}/appointments/mine",
        headers=psych_1["auth_headers"],
        params={"status": "completed"},
        timeout=15,
    )
    assert psych_completed.status_code == 200
    assert [a["appointment_id"] for a in psych_completed.json()] == [appt_id]


def test_multi_round_negotiation_and_cancel_flow(
    api_url: str,
    authenticated_user_factory,
    create_client_persona,
    future_slot_inputs,
):
    client = authenticated_user_factory("client")
    psych = authenticated_user_factory("psychologist")

    persona = create_client_persona(client["auth_headers"], name="Maria Clara")
    service = _first_active_service(api_url, "Standalone Clinical Consultation")

    prof_res = httpx.patch(
        f"{api_url}/psychologist-profile/me",
        headers=psych["auth_headers"],
        json={
            "social_media_links": [
                {"platform": "Facebook", "url": "https://facebook.com/psych.negotiation"}
            ]
        },
        timeout=15,
    )
    assert prof_res.status_code == 200, prof_res.text

    # Round 1: Client submits 3 preferred slots
    round1_slots = future_slot_inputs(days_ahead=7, hours=("09:00:00", "11:00:00", "14:00:00"))
    create_res = httpx.post(
        f"{api_url}/appointments",
        headers=client["auth_headers"],
        json={
            "persona_id": persona["persona_id"],
            "service_id": service["service_id"],
            "presenting_concern": "Initial clinical consultation",
            "preferred_slots": round1_slots,
        },
        timeout=15,
    )
    assert create_res.status_code == 200, create_res.text
    appt_id = create_res.json()["appointment_id"]

    # Round 2: Psychologist picks up with a counter-offer -> awaiting_schedule (turn=client)
    counter_1 = future_slot_inputs(days_ahead=8, hours=("16:00:00",))[0]
    pickup_res = httpx.post(
        f"{api_url}/appointments/{appt_id}/pickup",
        headers=psych["auth_headers"],
        json={"price": 1800.0, "counter_slot": counter_1},
        timeout=15,
    )
    assert pickup_res.status_code == 200, pickup_res.text
    after_pickup = pickup_res.json()
    assert after_pickup["status"] == "awaiting_schedule"
    assert after_pickup["scheduling_turn"] == "client"
    assert after_pickup["scheduling_round"] == 2

    # Round 3: Client declines counter-offer by submitting 3 new preferred schedules
    round3_slots = future_slot_inputs(days_ahead=9, hours=("09:30:00", "13:30:00", "15:30:00"))
    repropose_res = httpx.post(
        f"{api_url}/appointments/{appt_id}/preferred-slots",
        headers=client["auth_headers"],
        json={"slots": round3_slots},
        timeout=15,
    )
    assert repropose_res.status_code == 200, repropose_res.text
    after_repropose = repropose_res.json()
    assert after_repropose["status"] == "awaiting_schedule"
    assert after_repropose["scheduling_turn"] == "psychologist"
    assert after_repropose["scheduling_round"] == 3

    # Round 4: Psychologist offers another counter-slot -> turn=client
    counter_2 = future_slot_inputs(days_ahead=10, hours=("10:30:00",))[0]
    counter2_res = httpx.post(
        f"{api_url}/appointments/{appt_id}/counter-offer",
        headers=psych["auth_headers"],
        json=counter_2,
        timeout=15,
    )
    assert counter2_res.status_code == 200, counter2_res.text
    after_counter2 = counter2_res.json()
    assert after_counter2["scheduling_turn"] == "client"
    assert after_counter2["scheduling_round"] == 4

    psych_slot_r4 = next(
        s
        for s in after_counter2["proposed_slots"]
        if s["round"] == 4 and s["proposed_by"] == "psychologist" and s["status"] == "proposed"
    )

    # Client accepts the Round-4 counter-slot -> awaiting_payment
    accept_res = httpx.post(
        f"{api_url}/appointments/{appt_id}/accept-slot",
        headers=client["auth_headers"],
        json={"slot_id": psych_slot_r4["slot_id"]},
        timeout=15,
    )
    assert accept_res.status_code == 200, accept_res.text
    accepted = accept_res.json()
    assert accepted["status"] == "awaiting_payment"
    assert accepted["selected_slot_id"] == psych_slot_r4["slot_id"]
    assert accepted["payment_deadline"] is not None

    # Client cancels before paying -> cancelled
    cancel_res = httpx.delete(
        f"{api_url}/appointments/{appt_id}",
        headers=client["auth_headers"],
        timeout=15,
    )
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["status"] == "cancelled"
