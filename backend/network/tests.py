from django.test import TestCase

from rest_framework.test import APIClient

from accounts.models import CustomUser
from .models import Community, Connection, Notification, Post


class CommunityMembershipTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username="community-admin",
            email="admin@example.com",
            password="TestPass!123",
        )
        self.member = CustomUser.objects.create_user(
            username="community-member",
            email="member@example.com",
            password="TestPass!123",
        )
        self.community = Community.objects.create(
            name="Private Professionals",
            slug="private-professionals",
            community_type="private",
            creator=self.admin,
        )
        self.community.members.add(self.admin)
        self.client = APIClient()

    def test_community_listing_is_an_array_for_chat_clients(self):
        self.client.force_authenticate(self.member)
        response = self.client.get("/api/network/communities/")

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertIn("private", [item["community_type"] for item in response.data])

    def test_private_messages_require_approved_membership(self):
        self.client.force_authenticate(self.member)

        self.assertEqual(
            self.client.get(
                f"/api/network/communities/{self.community.id}/messages/"
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                f"/api/network/communities/{self.community.id}/messages/",
                {"content": "Hello"},
                format="json",
            ).status_code,
            403,
        )

        request_response = self.client.post(
            f"/api/network/communities/{self.community.id}/toggle-membership/"
        )
        self.assertEqual(request_response.status_code, 200)
        self.assertEqual(request_response.data["join_request_status"], "pending")
        self.assertFalse(request_response.data["joined"])

        self.client.force_authenticate(self.admin)
        requests = self.client.get("/api/network/communities/membership-requests/")
        self.assertEqual(requests.status_code, 200)
        self.assertEqual(len(requests.data), 1)

        ignored_request_id = requests.data[0]["id"]
        self.assertEqual(
            self.client.post("/api/network/communities/membership-requests/").status_code,
            405,
        )
        self.assertEqual(
            self.client.get("/api/network/communities/membership-requests/").data[0]["id"],
            ignored_request_id,
        )
        self.assertEqual(
            self.client.post(
                f"/api/network/communities/membership-requests/{ignored_request_id}/respond/",
                {"action": "allow"},
                format="json",
            ).status_code,
            200,
        )

        self.client.force_authenticate(self.member)
        self.assertEqual(
            self.client.get(
                f"/api/network/communities/{self.community.id}/messages/"
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(
                f"/api/network/communities/{self.community.id}/messages/",
                {"content": "Hello"},
                format="json",
            ).status_code,
            201,
        )

    def test_private_request_can_be_denied_and_resubmitted(self):
        self.client.force_authenticate(self.member)
        self.client.post(
            f"/api/network/communities/{self.community.id}/toggle-membership/"
        )

        self.client.force_authenticate(self.admin)
        membership_request = self.client.get(
            "/api/network/communities/membership-requests/"
        ).data[0]
        self.assertEqual(
            self.client.post(
                f"/api/network/communities/membership-requests/{membership_request['id']}/respond/",
                {"action": "deny"},
                format="json",
            ).status_code,
            200,
        )
        self.assertFalse(self.community.members.filter(id=self.member.id).exists())

        self.client.force_authenticate(self.member)
        retry = self.client.post(
            f"/api/network/communities/{self.community.id}/toggle-membership/"
        )
        self.assertEqual(retry.data["join_request_status"], "pending")

    def test_public_membership_actions_are_explicit_and_idempotent(self):
        public_community = Community.objects.create(
            name="Public Professionals",
            slug="public-professionals",
            creator=self.admin,
        )
        self.client.force_authenticate(self.member)

        joined = self.client.post(
            f"/api/network/communities/{public_community.id}/toggle-membership/",
            {"action": "join"},
            format="json",
        )
        repeated_join = self.client.post(
            f"/api/network/communities/{public_community.id}/toggle-membership/",
            {"action": "join"},
            format="json",
        )
        self.assertTrue(joined.data["joined"])
        self.assertTrue(repeated_join.data["joined"])
        self.assertTrue(public_community.members.filter(id=self.member.id).exists())

        left = self.client.post(
            f"/api/network/communities/{public_community.id}/toggle-membership/",
            {"action": "leave"},
            format="json",
        )
        repeated_leave = self.client.post(
            f"/api/network/communities/{public_community.id}/toggle-membership/",
            {"action": "leave"},
            format="json",
        )
        self.assertFalse(left.data["joined"])
        self.assertFalse(repeated_leave.data["joined"])
        self.assertIsNone(repeated_leave.data["join_request_status"])
        self.assertFalse(public_community.members.filter(id=self.member.id).exists())

    def test_post_activity_notification_is_private_and_markable(self):
        observer = CustomUser.objects.create_user(
            username="activity-observer",
            email="observer@example.com",
            password="test-password",
        )
        Connection.objects.create(
            from_user=self.member,
            to_user=observer,
            status="accepted",
        )
        post = Post.objects.create(author=self.admin, content="Network update")
        self.client.force_authenticate(self.member)
        self.client.post(f"/api/network/posts/{post.id}/like/")

        self.assertTrue(
            Notification.objects.filter(
                recipient=self.admin,
                actor=self.member,
                notification_type="post_like",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=observer,
                actor=self.member,
                notification_type="post_like",
            ).exists()
        )
        self.assertEqual(
            self.client.get("/api/network/notifications/").data["unread_count"],
            0,
        )
        self.client.force_authenticate(observer)
        self.assertEqual(
            self.client.get("/api/network/notifications/").data["unread_count"],
            1,
        )
        self.client.force_authenticate(self.admin)
        notification_list = self.client.get("/api/network/notifications/")
        self.assertEqual(notification_list.data["unread_count"], 1)
        notification_id = notification_list.data["results"][0]["id"]
        self.assertEqual(
            self.client.post(
                f"/api/network/notifications/{notification_id}/read/"
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get("/api/network/notifications/").data["unread_count"],
            0,
        )

    def test_private_community_invitation_requires_recipient_acceptance(self):
        self.client.force_authenticate(self.admin)
        invitation = self.client.post(
            "/api/network/communities/invitations/",
            {"community_id": self.community.id, "user_id": self.member.id},
            format="json",
        )
        self.assertEqual(invitation.status_code, 201)
        self.assertFalse(self.community.members.filter(id=self.member.id).exists())
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.member,
                notification_type="community_invitation",
            ).exists()
        )

        self.client.force_authenticate(self.member)
        invitations = self.client.get("/api/network/communities/invitations/")
        self.assertEqual(len(invitations.data), 1)
        response = self.client.post(
            f"/api/network/communities/invitations/{invitations.data[0]['id']}/respond/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.community.members.filter(id=self.member.id).exists())
        self.assertEqual(
            self.client.get(
                f"/api/network/communities/{self.community.id}/messages/"
            ).status_code,
            200,
        )

class ConnectionRequestTests(TestCase):
    def setUp(self):
        self.sender = CustomUser.objects.create_user(
            username="sender",
            email="sender@example.com",
            password="TestPass!123",
        )
        self.recipient = CustomUser.objects.create_user(
            username="recipient",
            email="recipient@example.com",
            password="TestPass!123",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.sender)

    def test_sender_can_withdraw_pending_request(self):
        response = self.client.post(
            f"/api/network/connections/request/{self.recipient.id}/"
        )
        self.assertEqual(response.status_code, 201)
        request_id = response.data["id"]

        withdrawn = self.client.delete(
            f"/api/network/connections/request/{request_id}/withdraw/"
        )
        self.assertEqual(withdrawn.status_code, 204)
        self.assertFalse(Connection.objects.filter(id=request_id).exists())

    def test_recipient_can_accept_request(self):
        response = self.client.post(
            f"/api/network/connections/request/{self.recipient.id}/"
        )
        request_id = response.data["id"]

        self.client.force_authenticate(self.recipient)
        accepted = self.client.post(
            f"/api/network/connections/respond/{request_id}/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(accepted.data["status"], "accepted")

    def test_recipient_can_decline_request(self):
        response = self.client.post(
            f"/api/network/connections/request/{self.recipient.id}/"
        )
        request_id = response.data["id"]

        self.client.force_authenticate(self.recipient)
        declined = self.client.post(
            f"/api/network/connections/respond/{request_id}/",
            {"action": "decline"},
            format="json",
        )
        self.assertEqual(declined.data["status"], "declined")
