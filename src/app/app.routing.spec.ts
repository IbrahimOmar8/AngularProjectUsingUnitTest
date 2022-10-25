import { Location } from '@angular/common';
import { DebugElement } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterLinkWithHref } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { routes } from './app-routing.module';
import { AppComponent } from './app.component';

fdescribe('AppComponent', () => {
    let component: AppComponent;
    let fixture: ComponentFixture<AppComponent>;
    let htmlPage: DebugElement;
    let location: Location;
    let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ RouterTestingModule.withRoutes(routes)], 
      declarations: [AppComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    htmlPage = fixture.debugElement
    location = TestBed.get(Location) 
    router = TestBed.get(Router)
    fixture.detectChanges();
    router.initialNavigation();
  });


  it("test route works on click",fakeAsync(()=> {

      var links = htmlPage.queryAll(By.directive(RouterLinkWithHref))
      console.log( "Links : " + links);
      console.log( " links[0] : " +  links[0].name);
    //   links[0].nativeElement.click()
      // tick(100)
      console.log("location.path() = " + location.path());
      
     // expect(location.path()).toEqual("/user")
  }))


});

