"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone,
  Snowflake,
  Flame,
  Fan,
  Thermometer,
  Wrench,
  CalendarCheck,
  Clock,
  Shield,
  Award,
  Star,
  CheckCircle,
  MapPin,
  Mail,
  Menu,
  X,
  BadgeCheck,
  Zap,
} from "lucide-react";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    service: "",
    message: "",
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setFormData({ name: "", email: "", phone: "", service: "", message: "" });
  };

  const services = [
    {
      icon: Snowflake,
      title: "AC Repair",
      description:
        "Fast, reliable air conditioning repairs to restore your comfort. Same-day service available.",
      image: "https://images.unsplash.com/photo-1580048915913-4f8f5cb481c4?w=600&q=80",
    },
    {
      icon: Flame,
      title: "Heating Services",
      description:
        "Furnace and heat pump repairs, maintenance, and installations to keep you warm all winter.",
      image: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80",
    },
    {
      icon: Fan,
      title: "System Installation",
      description:
        "Expert installation of new HVAC systems with top brands and energy-efficient options.",
      image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=80",
    },
    {
      icon: CalendarCheck,
      title: "Maintenance Plans",
      description:
        "Preventive maintenance programs to extend equipment life and prevent costly breakdowns.",
      image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=80",
    },
    {
      icon: Thermometer,
      title: "Indoor Air Quality",
      description:
        "Air purifiers, humidifiers, and filtration systems for healthier indoor air.",
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
    },
    {
      icon: Zap,
      title: "Emergency Service",
      description:
        "24/7 emergency HVAC repairs when you need us most. No extra charge for after-hours calls.",
      image: "https://images.unsplash.com/photo-1581141849291-1125c7b692b8?w=600&q=80",
    },
  ];

  const testimonials = [
    {
      name: "Sarah Mitchell",
      location: "Short Pump",
      rating: 5,
      text: "Our AC died on the hottest day of the year. Summit had a tech here within 2 hours and got us back up and running. The price was fair and the service was exceptional. Highly recommend!",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80",
    },
    {
      name: "David Patterson",
      location: "Midlothian",
      rating: 5,
      text: "We used Summit for a complete system replacement. They helped us choose the right size unit, handled all permits, and the install team was professional and clean. Five stars all around.",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80",
    },
    {
      name: "Linda Chen",
      location: "Glen Allen",
      rating: 5,
      text: "Been on their maintenance plan for two years now. They always call to schedule, show up on time, and my 15-year-old system is still running strong. Great preventive care!",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-2 rounded-lg">
                <Snowflake className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-xl text-gray-900">
                  Summit HVAC
                </span>
                <span className="hidden sm:inline text-xl text-gray-400 font-light ml-1">
                  Solutions
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#services"
                className="text-gray-600 hover:text-sky-600 transition"
              >
                Services
              </a>
              <a
                href="#about"
                className="text-gray-600 hover:text-sky-600 transition"
              >
                About
              </a>
              <a
                href="#testimonials"
                className="text-gray-600 hover:text-sky-600 transition"
              >
                Reviews
              </a>
              <a
                href="#contact"
                className="text-gray-600 hover:text-sky-600 transition"
              >
                Contact
              </a>
              <a href="tel:8045551234">
                <Button className="bg-sky-600 hover:bg-sky-700">
                  <Phone className="h-4 w-4 mr-2" />
                  (804) 555-1234
                </Button>
              </a>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-2">
              <a
                href="#services"
                className="block py-2 text-gray-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Services
              </a>
              <a
                href="#about"
                className="block py-2 text-gray-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </a>
              <a
                href="#testimonials"
                className="block py-2 text-gray-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Reviews
              </a>
              <a
                href="#contact"
                className="block py-2 text-gray-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </a>
              <a href="tel:8045551234" className="block">
                <Button className="w-full bg-sky-600 hover:bg-sky-700">
                  <Phone className="h-4 w-4 mr-2" />
                  (804) 555-1234
                </Button>
              </a>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section with Background Image */}
      <section className="relative pt-16 min-h-[90vh] flex items-center">
        {/* Hero Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1631545806609-2ab7b3ab7ebc?w=1920&q=80"
            alt="Modern comfortable home interior"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/40"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center bg-sky-500/20 backdrop-blur-sm text-sky-300 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-sky-500/30">
                <BadgeCheck className="h-4 w-4 mr-2" />
                Licensed & Insured • Serving Richmond Since 2005
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
                Comfort You Can{" "}
                <span className="text-sky-400">Count On</span>
              </h1>
              <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                From emergency AC repairs to complete system installations, Summit HVAC Solutions delivers reliable, expert service to keep your home comfortable year-round. Serving the Richmond metro area 24/7.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#contact">
                  <Button
                    size="lg"
                    className="bg-sky-500 hover:bg-sky-600 text-lg px-8 w-full sm:w-auto"
                  >
                    <CalendarCheck className="h-5 w-5 mr-2" />
                    Schedule Service
                  </Button>
                </a>
                <a href="tel:8045551234">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 text-lg px-8 w-full sm:w-auto"
                  >
                    <Phone className="h-5 w-5 mr-2" />
                    Get Free Estimate
                  </Button>
                </a>
              </div>
              <div className="flex items-center gap-6 mt-8 pt-8 border-t border-white/20">
                <div className="flex items-center">
                  <div className="flex -space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 text-amber-400 fill-amber-400"
                      />
                    ))}
                  </div>
                  <span className="ml-2 font-semibold text-white">4.9/5</span>
                </div>
                <span className="text-white/40">|</span>
                <span className="text-gray-300">850+ Reviews</span>
                <span className="text-white/40">|</span>
                <span className="text-gray-300">15,000+ Jobs</span>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-white border border-white/20">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-sky-500/30 rounded-full mb-4">
                    <Zap className="h-10 w-10 text-sky-300" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">24/7 Emergency Service</h3>
                  <p className="text-sky-200">
                    When your comfort can&apos;t wait, neither do we.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center bg-white/10 rounded-lg p-4">
                    <Clock className="h-6 w-6 mr-3 flex-shrink-0 text-sky-300" />
                    <div>
                      <p className="font-semibold">Same-Day Service</p>
                      <p className="text-sm text-sky-200">
                        Most calls answered within 2 hours
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center bg-white/10 rounded-lg p-4">
                    <Shield className="h-6 w-6 mr-3 flex-shrink-0 text-sky-300" />
                    <div>
                      <p className="font-semibold">100% Satisfaction</p>
                      <p className="text-sm text-sky-200">
                        Guaranteed workmanship on every job
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center bg-white/10 rounded-lg p-4">
                    <Award className="h-6 w-6 mr-3 flex-shrink-0 text-sky-300" />
                    <div>
                      <p className="font-semibold">Upfront Pricing</p>
                      <p className="text-sm text-sky-200">
                        No hidden fees or surprise charges
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-6 bg-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 text-white">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-sky-400" />
              <span className="text-sm font-medium">Licensed & Insured</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-sky-400" />
              <span className="text-sm font-medium">24/7 Emergency Service</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-sky-400" />
              <span className="text-sm font-medium">NATE Certified Techs</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-sky-400" />
              <span className="text-sm font-medium">Satisfaction Guaranteed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section with Images */}
      <section id="services" className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Services
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Complete heating and cooling solutions for residential and light commercial properties throughout Richmond.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <Card
                key={index}
                className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-gray-200"
              >
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-4 left-4 bg-sky-500 p-3 rounded-lg">
                    <service.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {service.title}
                  </h3>
                  <p className="text-gray-600">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-12">
            <a href="#contact">
              <Button size="lg" className="bg-sky-600 hover:bg-sky-700">
                Request a Free Estimate
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* About Section with Team Image */}
      <section id="about" className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-sky-600 font-semibold text-sm uppercase tracking-wider">About Us</span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 mt-2">
                Richmond&apos;s Trusted HVAC Experts Since 2005
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Summit HVAC Solutions was founded with a simple mission: provide honest, reliable heating and cooling services that treat every customer like family. Nearly two decades later, we&apos;re still locally owned and committed to that promise.
              </p>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Our NATE-certified technicians bring years of experience and ongoing training to every service call. We stay current with the latest technologies and techniques to ensure you get the best solutions for your comfort needs.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                  <p className="text-3xl font-bold text-sky-600">18+</p>
                  <p className="text-gray-600">Years Experience</p>
                </div>
                <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                  <p className="text-3xl font-bold text-sky-600">15,000+</p>
                  <p className="text-gray-600">Happy Customers</p>
                </div>
                <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                  <p className="text-3xl font-bold text-sky-600">25</p>
                  <p className="text-gray-600">Expert Technicians</p>
                </div>
                <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                  <p className="text-3xl font-bold text-sky-600">24/7</p>
                  <p className="text-gray-600">Emergency Service</p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              {/* Team Image */}
              <div className="relative rounded-2xl overflow-hidden shadow-xl">
                <img 
                  src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80"
                  alt="HVAC technician team at work"
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-sky-900/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <p className="font-semibold text-lg">Our Expert Team</p>
                  <p className="text-sky-200 text-sm">NATE Certified Professionals</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm flex items-start">
                  <div className="bg-green-100 p-2 rounded-lg mr-3 flex-shrink-0">
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Licensed & Insured</h3>
                    <p className="text-gray-500 text-xs mt-1">Full coverage for your peace of mind</p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm flex items-start">
                  <div className="bg-sky-100 p-2 rounded-lg mr-3 flex-shrink-0">
                    <Award className="h-5 w-5 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Quality Guaranteed</h3>
                    <p className="text-gray-500 text-xs mt-1">100% satisfaction promise</p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm flex items-start">
                  <div className="bg-amber-100 p-2 rounded-lg mr-3 flex-shrink-0">
                    <Star className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">5-Star Rated</h3>
                    <p className="text-gray-500 text-xs mt-1">Top reviews on Google & Yelp</p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm flex items-start">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3 flex-shrink-0">
                    <Wrench className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">All Major Brands</h3>
                    <p className="text-gray-500 text-xs mt-1">Carrier, Trane, Lennox & more</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section with Avatar Photos */}
      <section id="testimonials" className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sky-600 font-semibold text-sm uppercase tracking-wider">Testimonials</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 mt-2">
              What Our Customers Say
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Don&apos;t just take our word for it — hear from homeowners throughout the Richmond area who trust Summit HVAC.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 text-amber-400 fill-amber-400"
                      />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div className="flex items-center">
                    <img 
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full object-cover mr-4"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">
                        {testimonial.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {testimonial.location}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Service Area Section */}
      <section className="py-12 bg-sky-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <MapPin className="h-10 w-10 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Proudly Serving the Richmond Metro Area
          </h2>
          <p className="text-sky-100 max-w-3xl mx-auto mb-6">
            Including Short Pump, Glen Allen, Midlothian, Henrico, Chesterfield, Mechanicsville, and surrounding communities within 30 miles of downtown Richmond.
          </p>
          <a href="tel:8045551234">
            <Button size="lg" variant="secondary" className="bg-white text-sky-600 hover:bg-gray-100">
              <Phone className="h-5 w-5 mr-2" />
              Call (804) 555-1234
            </Button>
          </a>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <span className="text-sky-600 font-semibold text-sm uppercase tracking-wider">Contact Us</span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 mt-2">
                Get Your Free Estimate
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Fill out the form and we&apos;ll get back to you within 2 hours during business hours. For emergencies, call us directly — we&apos;re available 24/7.
              </p>
              <div className="space-y-6">
                <div className="flex items-center">
                  <div className="bg-sky-100 p-3 rounded-lg mr-4">
                    <Phone className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Call Us 24/7</p>
                    <a
                      href="tel:8045551234"
                      className="text-lg font-semibold text-gray-900 hover:text-sky-600"
                    >
                      (804) 555-1234
                    </a>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-sky-100 p-3 rounded-lg mr-4">
                    <Mail className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email Us</p>
                    <a
                      href="mailto:info@summithvac.com"
                      className="text-lg font-semibold text-gray-900 hover:text-sky-600"
                    >
                      info@summithvac.com
                    </a>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-sky-100 p-3 rounded-lg mr-4">
                    <MapPin className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Service Area</p>
                    <p className="text-lg font-semibold text-gray-900">
                      Richmond Metro & 30 Mile Radius
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-sky-100 p-3 rounded-lg mr-4">
                    <Clock className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Hours</p>
                    <p className="text-lg font-semibold text-gray-900">
                      Mon-Sat 7AM-7PM | 24/7 Emergency
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Card className="border-gray-200 shadow-lg">
                <CardContent className="p-6">
                  {formSubmitted ? (
                    <div className="text-center py-8">
                      <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Thank You!
                      </h3>
                      <p className="text-gray-600">
                        We&apos;ve received your request and will contact you within 2 hours.
                      </p>
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => setFormSubmitted(false)}
                      >
                        Send Another Request
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Full Name
                        </label>
                        <Input
                          id="name"
                          placeholder="John Smith"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="email"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Email
                          </label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="john@example.com"
                            value={formData.email}
                            onChange={(e) =>
                              setFormData({ ...formData, email: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="phone"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Phone
                          </label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="(804) 555-1234"
                            value={formData.phone}
                            onChange={(e) =>
                              setFormData({ ...formData, phone: e.target.value })
                            }
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="service"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Service Needed
                        </label>
                        <select
                          id="service"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={formData.service}
                          onChange={(e) =>
                            setFormData({ ...formData, service: e.target.value })
                          }
                          required
                        >
                          <option value="">Select a service...</option>
                          <option value="ac-repair">AC Repair</option>
                          <option value="heating">Heating Service</option>
                          <option value="installation">New System Installation</option>
                          <option value="maintenance">Maintenance / Tune-Up</option>
                          <option value="air-quality">Indoor Air Quality</option>
                          <option value="emergency">Emergency Service</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="message"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          How Can We Help?
                        </label>
                        <Textarea
                          id="message"
                          placeholder="Tell us about your HVAC issue or what you're looking for..."
                          rows={4}
                          value={formData.message}
                          onChange={(e) =>
                            setFormData({ ...formData, message: e.target.value })
                          }
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-sky-600 hover:bg-sky-700"
                        size="lg"
                      >
                        Request Free Estimate
                      </Button>
                      <p className="text-sm text-gray-500 text-center">
                        No spam, ever. We respect your privacy.
                      </p>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-2 rounded-lg">
                  <Snowflake className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-xl">Summit HVAC Solutions</span>
              </div>
              <p className="text-gray-400 mb-4">
                Locally owned and operated since 2005. Providing reliable, professional heating and cooling services to the Richmond community.
              </p>
              <p className="text-gray-400">VA License #HVAC-2705-123456</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#services" className="hover:text-white transition">
                    Services
                  </a>
                </li>
                <li>
                  <a href="#about" className="hover:text-white transition">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="hover:text-white transition">
                    Reviews
                  </a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-white transition">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="tel:8045551234" className="hover:text-white transition">
                    (804) 555-1234
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:info@summithvac.com"
                    className="hover:text-white transition"
                  >
                    info@summithvac.com
                  </a>
                </li>
                <li>Richmond Metro Area</li>
                <li className="text-sky-400">24/7 Emergency Service</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-gray-400">
            <p>
              © {new Date().getFullYear()} Summit HVAC Solutions. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
