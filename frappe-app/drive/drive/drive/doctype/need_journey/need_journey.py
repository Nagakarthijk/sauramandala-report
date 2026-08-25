import frappe
from frappe.model.document import Document

class NeedJourney(Document):
    def before_insert(self):
        if not self.stage:
            self.stage = "observed"
