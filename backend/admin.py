
from django.contrib import admin
from .models import User, Driver, Supervisor, Trip, ELDLog, ApprovalRequest

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
	list_display = ('username', 'email', 'role', 'is_active', 'is_staff')
	search_fields = ('username', 'email', 'role')
	list_filter = ('role', 'is_active', 'is_staff')
	ordering = ('username',)

@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
	list_display = ('user', 'license', 'truck', 'trailer', 'office', 'terminal', 'status', 'mileage', 'cycleUsed', 'tripsToday')
	search_fields = ('user__username', 'license', 'truck', 'trailer', 'office', 'terminal')
	list_filter = ('office', 'terminal', 'status')
	ordering = ('user',)

@admin.register(Supervisor)
class SupervisorAdmin(admin.ModelAdmin):
	list_display = ('user', 'office', 'email')
	search_fields = ('user__username', 'office', 'email')
	list_filter = ('office',)
	ordering = ('user',)


class ApprovalRequestInline(admin.TabularInline):
	model = ApprovalRequest
	extra = 0

@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
	list_display = ('driver', 'start', 'end', 'date', 'mileage', 'cycleUsed', 'status')
	search_fields = ('driver__user__username', 'start', 'end', 'status')
	list_filter = ('status', 'date')
	ordering = ('-date',)
	inlines = [ApprovalRequestInline]

@admin.register(ELDLog)
class ELDLogAdmin(admin.ModelAdmin):
	list_display = ('driver', 'date')
	search_fields = ('driver__user__username',)
	list_filter = ('date',)
	ordering = ('-date',)

@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
	list_display = ('trip', 'eldlog', 'supervisor', 'status', 'date')
	search_fields = ('trip__driver__user__username', 'supervisor__user__username', 'status')
	list_filter = ('status', 'date')
	ordering = ('-date',)
