import React, { Component } from 'react';
import Card from './components/Card/Card';
import Header from './components/Header/Header';
import Title from './components/Title/Title';
import Disclaimer from './components/Disclaimer/Disclaimer';
import { jsonResponse } from './components/copy';
import './App.css';

class App extends Component {
  render() {
    // var cardsList = jsonResponse.map(function(card){
    //   console.log(card.cardText);
    //   return <li>{card.cardText}</li>;
    // })
    return (
      <div className="App">
        <Header active="portfolio" />
        <Title copy="@ Wunderman / Thesedays" classes="title"/>

        <div className="card-container">
            <Title copy="Webpages" classes="title--cardContainer"/>
            <Card cardText={"Mazda asked Wunderman to create a LP for their Mazda MX-5 Car. I was Tasked to create these Pages togheter with the help of a senior Front-end developer"} cardTitle="Webpage: Mazda MX5 rijden voelt als reizen" cardBackground="url('https://nl.mazda.be/Assets/belgium/common/rijdenvoeltalsreizen/graphics/home_desk.jpg')" cardContentType="image" cardContentLink="assets/work/images/rijdenvoultalsreizen.png" cardContentLinkExt="https://nl.mazda.be/rijdenvoeltalsreizen/" cardLegal="© Mazda, made by Wunderman."/>
            <Card cardText={"MiniBabybel had a contest to win a Walkie Walkie-Talkie. I was tasked by wonderman to develop the front end of this site. No Live Preview available because the competition has ended."} cardTitle="Webpage: MiniBabybel TheSuperCheese Walkie-Talkie set" cardBackground="url('https://i.ytimg.com/vi_webp/brHZYSCfadI/maxresdefault.webp')" cardContentType="image" cardContentLink="assets/work/images/babybelwalkietalkie.png" cardContentLinkExt="https://www.babybel.nl/nl-nl" cardLegal="© Bel Group, made by Wunderman."/>
            <Card cardText={"Techdata wanted a way for resellers to motivate them. Wunderman provided a platform for this called journeytothecloud. I've developed huge portions of this site. Also I'm tasked to update and maintain this on occasion."} cardTitle="Webpage: Techdata Journey To the Cloud" cardBackground="url('https://journeytothecloud.be/resources/images/clouds.png')" cardContentType="image" cardContentLink="assets/work/images/journetothecloud.png" cardContentLinkExt="https://journeytothecloud.be" cardLegal="© Tech Data Recommends Microsoft® Software, made by Wunderman."/>
            <Card cardText={"Microsoft wanted a local blog for Belgium. This site was redesigned and I was tasked to redevelop this Wordpress site. Over Time this site has been rolled out for an Europe wide release. I'm tasked to update and maintain this on occasion."} cardTitle="Webpage: Microsoft Pulse Blog" cardBackground="url('https://pulse.microsoft.com/wp-content/themes/thesedays/resources/images/general/splash-bg.png')" cardContentType="image" cardContentLink="assets/work/images/pulse.png" cardContentLinkExt="https://pulse.microsoft.com/" cardLegal="© Microsoft, made by Wunderman."/>

            <Title copy="HTML5 Banners" classes="title--cardContainer"/>
            <Card cardText={"Telenet asked Wunderman to create a Cinemagraph banner for their new show Westworld from HBO. I was Tasked to create these html 5 banners"} cardTitle="Banner: HBO Westwold" cardBackground="url('https://i.redd.it/kgusq65sd1v01.jpg')" cardContentType="iframe" cardContentLink="assets/work/banners//westworld_300x250_NL_cinemagraph/index.html" cardLegal="© HBO, made by Wunderman."/>
            <Card cardText={"Telenet asked Wunderman to create a banner for their HBO Library. I was Tasked to create these html 5 banners"} cardTitle="Banner: Home of HBO" cardBackground="url('https://telnbmc8t503.tdlinx.be/build/hbo_600x500_NL/background4.jpg')" cardContentType="iframe" cardContentLink="https://telnbmc8t503.tdlinx.be/build/hbo_300x250_NL/index.html" cardLegal="© HBO, made by Wunderman."/>
            <Card cardText={"Telenet asked Wunderman to create a banner for their new serrie Insecure. I was Tasked to create these html 5 banners"} cardTitle="Banner: Play More Insecure" cardBackground="url('assets/work/images/insecure.jpeg')" cardContentType="iframe" cardContentLink="https://telnbmc8t542.tdlinx.be/build/Telenet_300x250_NL_insecure/index.html" cardLegal="© HBO, made by Wunderman."/>
            <Card cardText={"Lunchgarden asked Wunderman to create a banner for their rebranding that we did. I was Tasked to create these html 5 banners"} cardTitle="Banner: Lunchgarden Remarketing" cardBackground="url('https://lunchoc8t095.tdlinx.be/build/Lunchgarden-Q2_970x250_NL_remarketing/background.jpg')" cardContentType="iframe" cardContentLink="https://lunchoc8t095.tdlinx.be/build/Lunchgarden-Q2_300x250_FR_remarketing/index.html" cardLegal="© Lunchgarden, made by Wunderman."/>
        </div>
        {/*<ul>{ cardsList }</ul>*/}
        <Disclaimer />
      </div>
    );
  }
}

export default App;
