import frappe
from frappe.model.document import Document

class Referral(Document):
    def before_insert(self):
        if not self.company:
            ent = frappe.get_value("Entrepreneur", self.entrepreneur, "company")
            self.company = ent or frappe.defaults.get_user_default("Company")

    def on_update(self):
        if self.status == "COMPLETED" and self.commission_status == "pending":
            self.db_set("commission_status", "confirmed")


def has_permission(doc, ptype, user):
    if frappe.has_role("DRIVE Programme Officer", user) or frappe.has_role("Administrator", user):
        return True
    if frappe.has_role("DRIVE Provider", user):
        # Provider can only see referrals linked to their provider record
        provider = frappe.get_value("Provider", {"portal_user": user}, "name")
        return doc.provider == provider
    # Agent: own company only
    user_company = frappe.defaults.get_user_default("Company", user)
    return doc.company == user_company
